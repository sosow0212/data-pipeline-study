from datetime import date
from typing import Literal

from fastapi import APIRouter

from ops_agent.application.dashboard import ReadDashboard


def create_dashboard_router(reader: ReadDashboard) -> APIRouter:
    router = APIRouter()

    @router.get("/v1/metrics")
    def metrics(day: date, environment: Literal["production", "staging"] = "production"):
        return reader.execute(day, environment)

    return router
