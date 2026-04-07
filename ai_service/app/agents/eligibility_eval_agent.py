import logging
from typing import Callable

logger = logging.getLogger(__name__)


async def run(state: dict, llm_call_fn: Callable) -> dict:
    try:
        composite_score = state.get("composite_score", 0)
        band = state.get("band", "review")
        pq_score = state.get("pq_score", 0)
        pq_override = state.get("pq_override", False)
        prompt = (
            "You are an eligibility analyst. "
            f"The student scored {composite_score}/100 overall (band: {band}). "
            f"Their Potential Quotient score is {pq_score}/100. "
            f"PQ override applied: {pq_override}. "
            "Write 3 sentences: what drove the composite score, what the PQ score reveals about the student's "
            "non-academic potential, and how these combine into the final band."
        )
        rationale = llm_call_fn(prompt)
        state["eligibility_rationale"] = rationale.strip() if rationale else "Eligibility rationale unavailable."
    except Exception as exc:
        logger.error("eligibility_eval_agent failed: %s", exc)
        state["eligibility_rationale"] = "Eligibility evaluation could not be completed."
    return state
