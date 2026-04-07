import json
import logging
import re
from typing import Callable

logger = logging.getLogger(__name__)


def _parse_json_array(raw: str) -> list:
    raw = raw.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    return json.loads(raw)


async def run(state: dict, llm_call_fn: Callable) -> dict:
    try:
        loan_amount = state.get("loan_amount", 0)
        course = state.get("course", "Unknown")
        institution = state.get("institution", "Unknown")
        prompt = (
            "You are an RBI compliance officer. Review this education loan request: "
            f"₹{loan_amount} for {course} at {institution}. "
            "Check against: IBA Model Education Loan Scheme limits, RBI priority sector guidelines, "
            "CSIS interest subsidy eligibility. "
            "List any compliance flags as a JSON array of strings. If all clear, return []. "
            "Return ONLY a JSON array."
        )
        raw = llm_call_fn(prompt)
        try:
            flags = _parse_json_array(raw)
            if not isinstance(flags, list):
                flags = []
        except Exception:
            flags = []
        state["policy_flags"] = flags
    except Exception as exc:
        logger.error("policy_compliance_agent failed: %s", exc)
        state["policy_flags"] = []
    return state
