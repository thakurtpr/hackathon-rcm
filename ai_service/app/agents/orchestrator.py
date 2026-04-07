import logging
from typing import Callable, TypedDict

from langgraph.graph import END, StateGraph

from app.agents import (
    doc_verification_agent,
    eligibility_eval_agent,
    final_approval_agent,
    policy_compliance_agent,
    profile_agent,
)
from app.models.responses import ExplanationResult

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    app_id: str
    user_id: str
    composite_score: float
    band: str
    profile: dict
    doc_statuses: dict
    fraud_flag: bool
    pq_score: float
    loan_amount: float
    course: str
    institution: str
    profile_summary: str
    doc_verdict: str
    eligibility_rationale: str
    policy_flags: list
    final_decision: str
    explanation: str
    improvement_hints: list
    pq_override: bool


def _route_after_profile(state: AgentState) -> str:
    if state.get("fraud_flag", False):
        return "final_approval_agent"
    return "doc_verification_agent"


async def run(
    app_id: str,
    user_id: str,
    composite_score: float,
    band: str,
    pq_score: float,
    profile: dict,
    doc_statuses: dict,
    fraud_flag: bool,
    backend_client,
    llm_call_fn: Callable,
) -> dict:
    pq_override = 50 <= composite_score <= 69 and pq_score >= 80

    initial_state: AgentState = {
        "app_id": app_id,
        "user_id": user_id,
        "composite_score": composite_score,
        "band": band,
        "profile": profile,
        "doc_statuses": doc_statuses,
        "fraud_flag": fraud_flag,
        "pq_score": pq_score,
        "loan_amount": float(profile.get("loan_amount", 0)),
        "course": profile.get("course", "Unknown"),
        "institution": profile.get("institution", "Unknown"),
        "profile_summary": "",
        "doc_verdict": "",
        "eligibility_rationale": "",
        "policy_flags": [],
        "final_decision": "",
        "explanation": "",
        "improvement_hints": [],
        "pq_override": pq_override,
    }

    def make_node(agent_module):
        async def node(state: AgentState) -> AgentState:
            return await agent_module.run(state, llm_call_fn)
        return node

    graph = StateGraph(AgentState)
    graph.add_node("profile_agent", make_node(profile_agent))
    graph.add_node("doc_verification_agent", make_node(doc_verification_agent))
    graph.add_node("eligibility_eval_agent", make_node(eligibility_eval_agent))
    graph.add_node("policy_compliance_agent", make_node(policy_compliance_agent))
    graph.add_node("final_approval_agent", make_node(final_approval_agent))

    graph.set_entry_point("profile_agent")
    graph.add_conditional_edges(
        "profile_agent",
        _route_after_profile,
        {
            "doc_verification_agent": "doc_verification_agent",
            "final_approval_agent": "final_approval_agent",
        },
    )
    graph.add_edge("doc_verification_agent", "eligibility_eval_agent")
    graph.add_edge("eligibility_eval_agent", "policy_compliance_agent")
    graph.add_edge("policy_compliance_agent", "final_approval_agent")
    graph.add_edge("final_approval_agent", END)

    compiled = graph.compile()
    final_state = await compiled.ainvoke(initial_state)

    explanation_payload = ExplanationResult(
        app_id=app_id,
        decision_explanation=final_state.get("explanation", ""),
        improvement_hints=final_state.get("improvement_hints", []),
    )
    await backend_client.post_explanation_result(explanation_payload)

    return final_state
