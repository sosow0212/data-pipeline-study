from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from ops_agent.application.evidence import CollectEvidence
from ops_agent.domain.inquiry import Inquiry, ModelNotConfiguredError, UnknownServiceError


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    service_id: str = Field(pattern=r"^[a-z][a-z0-9-]{1,63}$")
    day: date
    question: str = Field(min_length=1, max_length=2000)
    environment: str = Field(default="production", pattern=r"^(production|staging)$")

    def to_domain(self) -> Inquiry:
        return Inquiry(**self.model_dump())


def create_router(collector: CollectEvidence, graph, model_configured: bool) -> APIRouter:
    router = APIRouter()

    def execute(operation):
        try:
            return operation()
        except UnknownServiceError as error:
            raise HTTPException(404, "Service is not in the ontology; run make ontology") from error
        except ModelNotConfiguredError as error:
            raise HTTPException(503, str(error)) from error
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @router.get("/healthz")
    def health():
        return {"status": "ok", "model_configured": model_configured}

    @router.post("/v1/evidence")
    def evidence(request: AnalysisRequest):
        return execute(lambda: collector.execute(request.to_domain()))

    @router.post("/v1/chat")
    def chat(request: AnalysisRequest):
        if not model_configured:
            raise HTTPException(503, "Set OPENAI_API_KEY in .env; /v1/evidence works without a key")
        result = execute(lambda: graph.invoke({"inquiry": request.to_domain()}))
        return {
            "answer": result["answer"],
            "evidence": result["evidence"],
            "usage": result["usage"],
        }

    return router
