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


async def post_kyc_result(payload: KYCResult) -> None:
    try:
        resp = await get_http_client().post("/ai/kyc-result", json=payload.model_dump())
        resp.raise_for_status()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
    except Exception as exc:
        logger.error("post_kyc_result failed: %s", exc)


async def post_behavioral_result(payload: BehavioralResult) -> None:
    try:
        data = {
            "app_id": payload.app_id,
            "pq_score": payload.pq_score,
            "fin_resp": payload.dimension_scores.fin_resp,
            "resilience": payload.dimension_scores.resilience,
            "goal_clarity": payload.dimension_scores.goal_clarity,
            "risk_aware": payload.dimension_scores.risk_aware,
            "initiative": payload.dimension_scores.initiative,
            "social_cap": payload.dimension_scores.social_cap,
            "question_hash": payload.question_hash,
            "time_flags": payload.time_flags,
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
    try:
        resp = await get_http_client().post("/ai/scholarship-result", json=payload.model_dump())
        resp.raise_for_status()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
    except Exception as exc:
        logger.error("post_scholarship_result failed: %s", exc)


async def post_explanation_result(payload: ExplanationResult) -> None:
    try:
        resp = await get_http_client().post("/ai/explanation-result", json=payload.model_dump())
        resp.raise_for_status()
    except httpx.ConnectError:
        logger.warning("Person B not reachable — operating in standalone mode")
    except Exception as exc:
        logger.error("post_explanation_result failed: %s", exc)
