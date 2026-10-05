import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from neo4j.exceptions import Neo4jError, ServiceUnavailable
from openai import OpenAIError
from requests.exceptions import RequestException
from trino.exceptions import Error as TrinoError
from trino.exceptions import HttpError

from ops_agent.application.dashboard import ReadDashboard
from ops_agent.application.evidence import CollectEvidence
from ops_agent.application.graph import build_graph
from ops_agent.infrastructure.neo4j import Neo4jKnowledgeRepository
from ops_agent.infrastructure.openai import OpenAIAnswerModel, OpenAIEmbeddingModel
from ops_agent.infrastructure.trino import TrinoMetricsRepository
from ops_agent.presentation.dashboard import create_dashboard_router
from ops_agent.presentation.http import create_router


def create_app() -> FastAPI:
    api_key = os.getenv("OPENAI_API_KEY", "")
    knowledge = Neo4jKnowledgeRepository(
        os.getenv("NEO4J_URI", "bolt://localhost:17687"),
        "neo4j",
        os.getenv("NEO4J_PASSWORD", "ops-lab-password"),
    )
    model = OpenAIAnswerModel(api_key, os.getenv("OPENAI_MODEL", "gpt-4.1-mini"))
    embeddings = OpenAIEmbeddingModel(
        api_key, os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    )
    metrics = TrinoMetricsRepository(
        os.getenv("TRINO_HOST", "localhost"), int(os.getenv("TRINO_PORT", "18091"))
    )
    collector = CollectEvidence(metrics, knowledge, embeddings)
    graph = build_graph(collector, model, semantic=os.getenv("SEMANTIC_SEARCH", "false") == "true")

    @asynccontextmanager
    async def lifespan(app):
        yield
        knowledge.close()
        if model.client is not None:
            model.client.close()
        if embeddings.client is not None:
            embeddings.client.close()

    app = FastAPI(title="Operations Learning Agent", version="0.1.0", lifespan=lifespan)

    async def evidence_unavailable(request, error):
        return JSONResponse(
            status_code=503,
            content={"detail": "Evidence backend unavailable; check lakehouse and ontology"},
        )

    async def model_unavailable(request, error):
        return JSONResponse(
            status_code=502,
            content={"detail": "OpenAI request failed; check model access and credentials"},
        )

    for exception in (Neo4jError, ServiceUnavailable, TrinoError, HttpError, RequestException):
        app.add_exception_handler(exception, evidence_unavailable)
    app.add_exception_handler(OpenAIError, model_unavailable)
    app.include_router(create_router(collector, graph, bool(api_key)))
    app.include_router(create_dashboard_router(ReadDashboard(metrics)))
    return app
