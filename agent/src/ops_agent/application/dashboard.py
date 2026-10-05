from datetime import date
from typing import Protocol


class DashboardMetricsRepository(Protocol):
    def overview(self, day: date, environment: str) -> dict: ...


class ReadDashboard:
    def __init__(self, metrics: DashboardMetricsRepository):
        self.metrics = metrics

    def execute(self, day: date, environment: str) -> dict:
        return self.metrics.overview(day, environment)
