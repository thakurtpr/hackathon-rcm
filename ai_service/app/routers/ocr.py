"""
OCR results router — lets the frontend fetch extracted document fields
that were stored in Redis after the Kafka doc.uploaded pipeline ran.
"""
import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from app.services import redis_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/ocr/result/{user_id}/{doc_type}")
async def get_ocr_result(user_id: str, doc_type: str) -> Dict[str, Any]:
    """
    Returns OCR-extracted fields for a specific document.
    Stored in Redis by the Kafka handler after ocr_pipeline.run().

    Response shape:
      { "doc_type": "aadhaar", "fields": {"name": "Rahul", ...},
        "doc_trust_score": 0.82, "doc_authentic": true }
    Returns 404 if OCR hasn't run yet or result expired.
    """
    data = await redis_service.get_json(f"ocr:result:{user_id}:{doc_type}")
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"OCR result not yet available for user={user_id} doc_type={doc_type}",
        )
    return data
