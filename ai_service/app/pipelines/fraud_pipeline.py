import asyncio
import hashlib
import logging
import re

from app.models.responses import FraudCheck, FraudResult

logger = logging.getLogger(__name__)

HARD_FAIL_CHECKS = {"duplicate_pan", "duplicate_aadhaar", "face_pool_duplicate"}


async def check_duplicate_pan(pan_number: str, backend_client) -> FraudCheck:
    try:
        pan_clean = pan_number.upper().strip()
        pan_hash = hashlib.sha256(pan_clean.encode()).hexdigest()
        exists = await backend_client.check_pan(pan_hash)
        return FraudCheck(
            check_name="duplicate_pan",
            passed=not exists,
            reason="PAN already registered with another account" if exists else None,
        )
    except Exception as exc:
        logger.error("check_duplicate_pan failed: %s", exc)
        return FraudCheck(check_name="duplicate_pan", passed=True)


async def check_duplicate_aadhaar(aadhaar_number: str, backend_client) -> FraudCheck:
    try:
        clean = re.sub(r"\s", "", aadhaar_number)
        aadhaar_hash = hashlib.sha256(clean.encode()).hexdigest()
        exists = await backend_client.check_aadhaar(aadhaar_hash)
        return FraudCheck(
            check_name="duplicate_aadhaar",
            passed=not exists,
            reason="Aadhaar already registered with another account" if exists else None,
        )
    except Exception as exc:
        logger.error("check_duplicate_aadhaar failed: %s", exc)
        return FraudCheck(check_name="duplicate_aadhaar", passed=True)


async def check_face_pool(user_id: str, selfie_embedding: list, qdrant_service) -> FraudCheck:
    try:
        if not selfie_embedding:
            return FraudCheck(check_name="face_pool_duplicate", passed=True, reason=None)
        results = await qdrant_service.search(
            "face_embeddings", selfie_embedding, limit=5, score_threshold=0.92
        )
        fraud = any(
            r.payload.get("user_id") != user_id
            for r in results
            if hasattr(r, "payload") and r.payload
        )
        return FraudCheck(
            check_name="face_pool_duplicate",
            passed=not fraud,
            reason="Face matches another registered account" if fraud else None,
        )
    except Exception as exc:
        logger.error("check_face_pool failed: %s", exc)
        return FraudCheck(check_name="face_pool_duplicate", passed=True)


async def check_doc_metadata(doc_ids: list, backend_client) -> FraudCheck:
    try:
        tamper_found = False
        for doc_id in doc_ids:
            status = await backend_client.get_document_status(doc_id)
            if status and status.get("tamper_flag", False):
                tamper_found = True
                break
        return FraudCheck(
            check_name="doc_metadata",
            passed=not tamper_found,
            reason="Document tamper flag detected" if tamper_found else None,
        )
    except Exception as exc:
        logger.error("check_doc_metadata failed: %s", exc)
        return FraudCheck(check_name="doc_metadata", passed=True)


async def check_velocity(user_id: str, backend_client) -> FraudCheck:
    try:
        count = await backend_client.get_app_count(user_id, days=30)
        fraud = count > 2
        return FraudCheck(
            check_name="velocity_check",
            passed=not fraud,
            reason=f"{count} applications submitted in last 30 days" if fraud else None,
        )
    except Exception as exc:
        logger.error("check_velocity failed: %s", exc)
        return FraudCheck(check_name="velocity_check", passed=True)


async def run_all(
    app_id: str,
    user_id: str,
    pan_number: str,
    aadhaar_number: str,
    mobile: str,
    doc_ids: list,
    selfie_embedding: list,
    backend_client,
    qdrant_service,
) -> FraudResult:
    checks = await asyncio.gather(
        check_duplicate_pan(pan_number, backend_client),
        check_duplicate_aadhaar(aadhaar_number, backend_client),
        check_face_pool(user_id, selfie_embedding, qdrant_service),
        check_doc_metadata(doc_ids, backend_client),
        check_velocity(user_id, backend_client),
    )

    fraud_flag = any(
        not c.passed and c.check_name in HARD_FAIL_CHECKS
        for c in checks
    )
    fraud_reasons = [c.reason for c in checks if not c.passed and c.reason]
    fraud_confidence = round((len([c for c in checks if not c.passed]) / 5) * 100, 2)

    return FraudResult(
        app_id=app_id,
        fraud_flag=fraud_flag,
        fraud_reasons=fraud_reasons,
        fraud_confidence=fraud_confidence,
        checks=list(checks),
    )
