from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient
from ops_agent.application.dashboard import ReadDashboard
from ops_agent.presentation.dashboard import create_dashboard_router


class Metrics:
    def overview(self, day, environment):
        assert day == date(2026, 10, 1)
        assert environment == "staging"
        return {"hourly_metrics": [], "aggregated_at": None, "truncated": False}


def test_dashboard_filters_are_validated_before_reading_metrics():
    app = FastAPI()
    app.include_router(create_dashboard_router(ReadDashboard(Metrics())))
    client = TestClient(app)
    result = client.get("/v1/metrics?day=2026-10-01&environment=staging")
    assert result.status_code == 200
    assert result.json()["hourly_metrics"] == []
    assert client.get("/v1/metrics?day=invalid").status_code == 422
    assert client.get("/v1/metrics?day=2026-10-01&environment=unknown").status_code == 422
