import logging
from typing import Optional

import httpx

from app.config import get_settings
from app.models.responses import (
    BehavioralResult,
    ExplanationResult,
    FraudResult,
    KYCResult,
    ScholarshipResult,
)

logger = logging.getLogger(__name__)

_http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        settings = get_settings()
        _http_client = httpx.AsyncClient(
            base_url=settings.backend_base_url,
            timeout=30.0,
        )
    return _http_client


async def get_profile(user_id: str) -> Optional[dict]:
    try:
        resp = await get_http_client().get(f"/users/{user_id}/profile")
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
        return None
    except Exception as exc:
        logger.error("get_profile(%s) failed: %s", user_id, exc)
        return None


async def check_pan(pan_hash: str) -> bool:
    try:
        resp = await get_http_client().get("/users/check-pan", params={"pan": pan_hash})
        resp.raise_for_status()
        data = resp.json()
        return bool(data.get("exists", False))
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
        return False
    except Exception as exc:
        logger.error("check_pan failed: %s", exc)
        return False


async def check_aadhaar(aadhaar_hash: str) -> bool:
    try:
        resp = await get_http_client().get("/users/check-aadhaar", params={"hash": aadhaar_hash})
        resp.raise_for_status()
        data = resp.json()
        return bool(data.get("exists", False))
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
        return False
    except Exception as exc:
        logger.error("check_aadhaar failed: %s", exc)
        return False


async def get_app_count(user_id: str, days: int = 30) -> int:
    try:
        resp = await get_http_client().get(f"/users/{user_id}/app-count", params={"days": days})
        resp.raise_for_status()
        data = resp.json()
        return int(data.get("count", 0))
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
        return 0
    except Exception as exc:
        logger.error("get_app_count(%s) failed: %s", user_id, exc)
        return 0


async def get_document_status(doc_id: str) -> Optional[dict]:
    try:
        resp = await get_http_client().get(f"/documents/{doc_id}/status")
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
        return None
    except Exception as exc:
        logger.error("get_document_status(%s) failed: %s", doc_id, exc)
        return None


async def post(path: str, data: dict) -> None:
    """Generic POST helper for arbitrary payloads."""
    try:
        resp = await get_http_client().post(path, json=data)
        resp.raise_for_status()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
    except Exception as exc:
        logger.error("POST %s failed: %s", path, exc)


async def post_kyc_result(payload: KYCResult) -> None:
    try:
        resp = await get_http_client().post("/ai/kyc-result", json=payload.model_dump())
        resp.raise_for_status()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
    except Exception as exc:
        logger.error("post_kyc_result failed: %s", exc)


async def post_behavioral_result(payload: BehavioralResult, answers: list | None = None) -> None:
    try:
        data = {
            "app_id": payload.app_id,
            "pq_score": payload.pq_score,
            "question_hash": payload.question_hash,
            "dimension_scores": {
                "financial_responsibility": payload.dimension_scores.fin_resp,
                "resilience": payload.dimension_scores.resilience,
                "goal_clarity": payload.dimension_scores.goal_clarity,
                "risk_awareness": payload.dimension_scores.risk_aware,
                "initiative": payload.dimension_scores.initiative,
                "social_capital": payload.dimension_scores.social_cap,
            },
            "time_flags": payload.time_flags,
            "answers": [
                {
                    "question_id": (a.question_id if hasattr(a, "question_id") else a["question_id"]),
                    "answer": (a.answer if hasattr(a, "answer") else a["answer"]),
                    "time_taken_seconds": (
                        a.time_taken_seconds if hasattr(a, "time_taken_seconds") else a.get("time_taken_seconds", 0)
                    ),
                }
                for a in (answers or [])
            ],
        }
        resp = await get_http_client().post("/ai/behavioral-result", json=data)
        resp.raise_for_status()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
    except Exception as exc:
        logger.error("post_behavioral_result failed: %s", exc)


async def post_fraud_result(payload: FraudResult) -> None:
    try:
        resp = await get_http_client().post("/ai/fraud-result", json=payload.model_dump())
        resp.raise_for_status()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
    except Exception as exc:
        logger.error("post_fraud_result failed: %s", exc)


async def post_scholarship_result(payload: ScholarshipResult) -> None:
    """Post to PersonB using the agreed API contract shape."""
    try:
        data = {
            "user_id": payload.app_id,  # app_id maps to user context for PersonB
            "scholarships": [
                {
                    "id": s.source or s.name,
                    "name": s.name,
                    "amount": s.amount,
                    "reason": s.reason,
                }
                for s in payload.matched_scholarships
            ],
            "count": len(payload.matched_scholarships),
        }
        resp = await get_http_client().post("/ai/scholarship-result", json=data)
        resp.raise_for_status()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
    except Exception as exc:
        logger.error("post_scholarship_result failed: %s", exc)


async def post_explanation_result(payload: ExplanationResult) -> None:
    """Post to PersonB using the agreed API contract shape."""
    try:
        decision = payload.decision_explanation.lower()
        if "approved" in decision:
            recommendation = "approved"
        elif "reject" in decision or "denied" in decision:
            recommendation = "rejected"
        else:
            recommendation = "conditional"
        data = {
            "user_id": payload.app_id,
            "explanation": payload.decision_explanation,
            "recommendation": recommendation,
            "confidence": 0.85,  # default confidence; updated when model provides it
        }
        resp = await get_http_client().post("/ai/explanation-result", json=data)
        resp.raise_for_status()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
    except Exception as exc:
        logger.error("post_explanation_result failed: %s", exc)
