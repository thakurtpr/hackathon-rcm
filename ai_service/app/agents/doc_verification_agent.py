import logging
from typing import Callable

logger = logging.getLogger(__name__)


async def run(state: dict, llm_call_fn: Callable) -> dict:
    try:
        doc_statuses = state.get("doc_statuses", {})
        prompt = (
            "You are a document verification officer. Based on these KYC document results, "
            "write exactly 2 sentences as a formal verification verdict. "
            f"Doc statuses: {doc_statuses}"
        )
        verdict = llm_call_fn(prompt)
        state["doc_verdict"] = verdict.strip() if verdict else "Document verification could not be completed."
    except Exception as exc:
        logger.error("doc_verification_agent failed: %s", exc)
        state["doc_verdict"] = "Document verification status unknown."
    return state
