from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from ops_agent.application.evidence import CollectEvidence
from ops_agent.application.ports import AnswerModel
from ops_agent.domain.inquiry import Inquiry


class AnalysisState(TypedDict, total=False):
    inquiry: Inquiry
    evidence: dict
    answer: str
    usage: dict


def build_graph(collector: CollectEvidence, model: AnswerModel, *, semantic: bool = False):
    def collect(state: AnalysisState) -> dict:
        return {"evidence": collector.execute(state["inquiry"], semantic=semantic)}

    def answer(state: AnalysisState) -> dict:
        result = model.answer(state["inquiry"].question, state["evidence"])
        return {"answer": result["answer"], "usage": result["usage"]}

    graph = StateGraph(AnalysisState)
    graph.add_node("collect_evidence", collect)
    graph.add_node("answer", answer)
    graph.add_edge(START, "collect_evidence")
    graph.add_edge("collect_evidence", "answer")
    graph.add_edge("answer", END)
    return graph.compile()
