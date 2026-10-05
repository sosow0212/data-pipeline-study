from datetime import date
from typing import Protocol


class MetricsRepository(Protocol):
    def hourly(self, service_ids: list[str], day: date, environment: str) -> list[dict]: ...


class KnowledgeRepository(Protocol):
    def topology(self, service_id: str) -> dict: ...
    def runbooks(
        self, service_ids: list[str], question: str, embedding: list[float] | None
    ) -> list[dict]: ...


class AnswerModel(Protocol):
    def answer(self, question: str, evidence: dict) -> dict: ...


class EmbeddingModel(Protocol):
    def embed(self, texts: list[str]) -> tuple[list[list[float]], int]: ...
