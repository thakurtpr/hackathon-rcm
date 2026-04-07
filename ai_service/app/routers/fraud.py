"""
Fraud deduplication endpoints called by the Go backend and AI service.
GET /users/check-pan?pan=<sha256_hash>
GET /users/check-aadhaar?hash=<sha256_hash>
GET /users/{user_id}/app-count?days=30
"""
import logging

import httpx
from fastapi import APIRouter, Query

from app.config import get_settings
from app.models.responses import HealthResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/users/check-pan")
async def check_pan(pan: str = Query(..., description="SHA-256 hash of PAN number")) -> dict:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=5.0) as client:
            resp = await client.get("/users/check-pan", params={"pan": pan})
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("Backend check-pan failed: %s", exc)
        return {"exists": False}


@router.get("/users/check-aadhaar")
async def check_aadhaar(hash: str = Query(..., description="SHA-256 hash of Aadhaar number")) -> dict:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=5.0) as client:
            resp = await client.get("/users/check-aadhaar", params={"hash": hash})
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("Backend check-aadhaar failed: %s", exc)
        return {"exists": False}


@router.get("/users/{user_id}/app-count")
async def get_app_count(user_id: str, days: int = Query(30, ge=1, le=365)) -> dict:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=5.0) as client:
            resp = await client.get(f"/users/{user_id}/app-count", params={"days": days})
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("Backend app-count failed: %s", exc)
        return {"count": 0}
