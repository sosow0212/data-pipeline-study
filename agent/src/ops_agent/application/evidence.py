from ops_agent.application.ports import EmbeddingModel, KnowledgeRepository, MetricsRepository
from ops_agent.domain.inquiry import Inquiry


class CollectEvidence:
    def __init__(
        self,
        metrics: MetricsRepository,
        knowledge: KnowledgeRepository,
        embeddings: EmbeddingModel | None = None,
    ):
        self.metrics = metrics
        self.knowledge = knowledge
        self.embeddings = embeddings

    def execute(self, inquiry: Inquiry, *, semantic: bool = False) -> dict:
        topology = self.knowledge.topology(inquiry.service_id)
        service_ids = sorted({inquiry.service_id, *topology["dependencies"]})
        vector = None
        embedding_tokens = 0
        if semantic and self.embeddings is not None:
            vectors, embedding_tokens = self.embeddings.embed([inquiry.question])
            vector = vectors[0]
        return {
            "service_id": inquiry.service_id,
            "day": inquiry.day.isoformat(),
            "environment": inquiry.environment,
            "topology": topology,
            "hourly_metrics": self.metrics.hourly(service_ids, inquiry.day, inquiry.environment),
            "runbooks": self.knowledge.runbooks(service_ids, inquiry.question, vector),
            "embedding_tokens": embedding_tokens,
            "sources": ["Trino:lake.gold.service_hourly", "Neo4j:Service/Team/Runbook"],
            "limitations": [
                "모의 데이터이며 실제 운영 장애를 관측한 결과가 아닙니다.",
                "의존 관계와 시간적 상관관계만으로 장애 원인을 확정할 수 없습니다.",
                "Gold 지표는 마지막 집계 작업 시점까지의 로그를 반영합니다.",
            ],
        }
