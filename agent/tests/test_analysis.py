from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from ops_agent.application.evidence import CollectEvidence
from ops_agent.application.graph import build_graph
from ops_agent.domain.inquiry import Inquiry
from ops_agent.presentation.http import create_router


class Metrics:
    def hourly(self, service_ids, day, environment):
        assert service_ids == ["checkout", "payment"]
        return [{"service_id": "payment", "requests": 100, "errors": 60, "error_rate": 0.6}]


class Knowledge:
    def topology(self, service_id):
        return {"dependencies": ["payment"], "potentially_affected": ["gateway"]}

    def runbooks(self, service_ids, question, embedding):
        return [{"id": "payment-timeout", "content": "Check dependency latency"}]


class Model:
    def __init__(self):
        self.evidence = None

    def answer(self, question, evidence):
        self.evidence = evidence
        return {"answer": "Test answer", "usage": {"input_tokens": 10, "output_tokens": 5}}


class NeverEmbed:
    def embed(self, texts):
        raise AssertionError("evidence endpoint must not call paid embeddings")


def test_graph_passes_real_evidence_to_answer_model():
    collector = CollectEvidence(Metrics(), Knowledge())
    model = Model()
    result = build_graph(collector, model).invoke(
        {"inquiry": Inquiry("checkout", date(2026, 10, 1), "Why did checkout time out?")}
    )
    assert result["evidence"] == model.evidence
    assert result["evidence"]["hourly_metrics"][0]["errors"] == 60
    assert result["usage"]["input_tokens"] == 10


def test_api_cost_boundary_and_input_validation():
    collector = CollectEvidence(Metrics(), Knowledge(), NeverEmbed())
    model = Model()
    app = FastAPI()
    app.include_router(create_router(collector, build_graph(collector, model), False))
    client = TestClient(app)
    payload = {"service_id": "checkout", "day": "2026-10-01", "question": "timeout"}
    assert client.post("/v1/evidence", json=payload).status_code == 200
    assert client.post("/v1/chat", json=payload).status_code == 503
    assert model.evidence is None
    assert (
        client.post(
            "/v1/evidence", json={**payload, "service_id": "x'; DROP TABLE logs"}
        ).status_code
        == 422
    )
    assert client.post("/v1/evidence", json={**payload, "question": "  "}).status_code == 422


def test_domain_rejects_invalid_environment():
    with pytest.raises(ValueError):
        Inquiry("checkout", date(2026, 10, 1), "timeout", environment="unknown")
