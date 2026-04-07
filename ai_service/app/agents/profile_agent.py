import logging
from typing import Callable

logger = logging.getLogger(__name__)


async def run(state: dict, llm_call_fn: Callable) -> dict:
    try:
        profile = state.get("profile", {})
        prompt = (
            "You are reviewing a student loan application. Summarize this student profile for a bank loan committee "
            "in exactly 3 sentences. First sentence: academic and financial background. "
            "Second sentence: loan request context. Third sentence: key strengths and risks. "
            f"Profile data: {profile}"
        )
        summary = llm_call_fn(prompt)
        state["profile_summary"] = summary.strip() if summary else "Profile summary unavailable."
    except Exception as exc:
        logger.error("profile_agent failed: %s", exc)
        state["profile_summary"] = "Profile summary could not be generated."
    return state
