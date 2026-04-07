import asyncio
import hashlib
import logging
import re

from app.models.responses import FraudCheck, FraudResult

logger = logging.getLogger(__name__)

HARD_FAIL_CHECKS = {"duplicate_pan", "duplicate_aadhaar", "face_pool_match"}

_TOTAL_CHECKS = 5


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
            return FraudCheck(check_name="face_pool_match", passed=True, reason=None)
        results = await qdrant_service.search(
            "face_embeddings", selfie_embedding, limit=5, score_threshold=0.92
        )
        fraud = any(
            r.payload.get("user_id") != user_id
            for r in results
            if hasattr(r, "payload") and r.payload
        )
        return FraudCheck(
            check_name="face_pool_match",
            passed=not fraud,
            reason="Face matches another registered account" if fraud else None,
        )
    except Exception as exc:
        logger.error("check_face_pool failed: %s", exc)
        return FraudCheck(check_name="face_pool_match", passed=True)


async def check_income_inconsistency(ocr_income: float, profile_income: float) -> FraudCheck:
    """Flag if the absolute relative deviation between OCR-extracted and declared income > 40%."""
    try:
        if profile_income and profile_income != 0:
            deviation = abs(ocr_income - profile_income) / abs(profile_income)
        else:
            # No profile income to compare — treat as passing
            return FraudCheck(check_name="income_inconsistency", passed=True, reason=None)
        fraud = deviation > 0.40
        return FraudCheck(
            check_name="income_inconsistency",
            passed=not fraud,
            reason=(
                f"Income deviation {deviation:.0%} exceeds 40% threshold"
                if fraud
                else None
            ),
        )
    except Exception as exc:
        logger.error("check_income_inconsistency failed: %s", exc)
        return FraudCheck(check_name="income_inconsistency", passed=True)


async def check_velocity(user_id: str, backend_client) -> FraudCheck:
    try:
        count = await backend_client.get_app_count(user_id, days=30)
        fraud = count > 2
        return FraudCheck(
            check_name="velocity_flag",
            passed=not fraud,
            reason=f"{count} applications submitted in last 30 days" if fraud else None,
        )
    except Exception as exc:
        logger.error("check_velocity failed: %s", exc)
        return FraudCheck(check_name="velocity_flag", passed=True)


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
    ocr_income: float = 0.0,
    profile_income: float = 0.0,
) -> FraudResult:
    checks = await asyncio.gather(
        check_duplicate_pan(pan_number, backend_client),
        check_duplicate_aadhaar(aadhaar_number, backend_client),
        check_face_pool(user_id, selfie_embedding, qdrant_service),
        check_velocity(user_id, backend_client),
        check_income_inconsistency(ocr_income, profile_income),
    )

    fraud_flag = any(
        not c.passed and c.check_name in HARD_FAIL_CHECKS
        for c in checks
    )
    fraud_reasons = [c.reason for c in checks if not c.passed and c.reason]
    fraud_confidence = round(
        (len([c for c in checks if not c.passed]) / _TOTAL_CHECKS) * 100, 2
    )

    return FraudResult(
        app_id=app_id,
        fraud_flag=fraud_flag,
        fraud_reasons=fraud_reasons,
        fraud_confidence=fraud_confidence,
        checks=list(checks),
    )


async def run_fraud_checks(
    user_id: str,
    ocr_data: dict,
    profile_data: dict,
    backend_client,
    qdrant_service,
) -> dict:
    """Simplified entry point matching the canonical signature used by orchestration layers.

    Args:
        user_id: The applicant's user identifier.
        ocr_data: Extracted OCR fields including pan_number, aadhaar_number, annual_income.
        profile_data: User's declared profile fields including pan_number, aadhaar_number,
                      annual_income, face_embedding, app_id.
        backend_client: Async HTTP client for Person B endpoints.
        qdrant_service: Qdrant vector-search service.

    Returns:
        dict with keys: user_id, fraud_flag, fraud_confidence, checks.
    """
    app_id = profile_data.get("app_id", user_id)
    pan_number = ocr_data.get("pan_number", profile_data.get("pan_number", ""))
    aadhaar_number = ocr_data.get("aadhaar_number", profile_data.get("aadhaar_number", ""))
    face_embedding = profile_data.get("face_embedding", [])
    ocr_income = float(ocr_data.get("annual_income", 0) or 0)
    profile_income = float(profile_data.get("annual_income", 0) or 0)

    result = await run_all(
        app_id=app_id,
        user_id=user_id,
        pan_number=pan_number,
        aadhaar_number=aadhaar_number,
        mobile=profile_data.get("mobile", ""),
        doc_ids=[],
        selfie_embedding=face_embedding if isinstance(face_embedding, list) else [],
        backend_client=backend_client,
        qdrant_service=qdrant_service,
        ocr_income=ocr_income,
        profile_income=profile_income,
    )

    return {
        "user_id": user_id,
        "fraud_flag": result.fraud_flag,
        "fraud_confidence": result.fraud_confidence,
        "checks": {c.check_name: not c.passed for c in result.checks},
    }
