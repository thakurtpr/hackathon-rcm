import json
import logging
import re
from typing import Callable

from app.prompts.explanation import FINAL_EXPLANATION_PROMPT

logger = logging.getLogger(__name__)


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    return json.loads(raw)


async def run(state: dict, llm_call_fn: Callable) -> dict:
    try:
        prompt = FINAL_EXPLANATION_PROMPT.format(
            profile_summary=state.get("profile_summary", ""),
            doc_verdict=state.get("doc_verdict", ""),
            eligibility_rationale=state.get("eligibility_rationale", ""),
            policy_flags=state.get("policy_flags", []),
            band=state.get("band", "review"),
            pq_override=state.get("pq_override", False),
        )
        raw = llm_call_fn(prompt)
        try:
            parsed = _parse_json(raw)
            explanation = parsed.get("explanation", "")
            hints = parsed.get("improvement_hints", [])
        except Exception:
            explanation = raw.strip() if raw else "Your application is under review."
            hints = []

        state["explanation"] = explanation
        state["improvement_hints"] = hints[:3] if hints else []
        state["final_decision"] = state.get("band", "review")
    except Exception as exc:
        logger.error("final_approval_agent failed: %s", exc)
        state["explanation"] = "Your application is currently under review."
        state["improvement_hints"] = []
        state["final_decision"] = state.get("band", "review")
    return state
