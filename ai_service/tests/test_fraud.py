import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.responses import FraudCheck, FraudResult
from app.pipelines.fraud_pipeline import (
    HARD_FAIL_CHECKS,
    run_all,
    run_fraud_checks,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_backend(
    pan_exists: bool = False,
    aadhaar_exists: bool = False,
    app_count: int = 0,
) -> AsyncMock:
    mock = AsyncMock()
    mock.check_pan = AsyncMock(return_value=pan_exists)
    mock.check_aadhaar = AsyncMock(return_value=aadhaar_exists)
    mock.get_app_count = AsyncMock(return_value=app_count)
    return mock


def _make_qdrant(search_results: list | None = None) -> AsyncMock:
    mock = AsyncMock()
    mock.search = AsyncMock(return_value=search_results or [])
    return mock


# ---------------------------------------------------------------------------
# Hard-fail: duplicate_pan
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hard_fail_on_duplicate_pan():
    result = await run_all(
        app_id="test-001",
        user_id="user-001",
        pan_number="ABCDE1234F",
        aadhaar_number="1234 5678 9012",
        mobile="9999999999",
        doc_ids=[],
        selfie_embedding=[0.1] * 512,
        backend_client=_make_backend(pan_exists=True),
        qdrant_service=_make_qdrant(),
    )

    assert result.fraud_flag is True
    failed_names = [c.check_name for c in result.checks if not c.passed]
    assert "duplicate_pan" in failed_names


# ---------------------------------------------------------------------------
# Hard-fail: duplicate_aadhaar
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hard_fail_on_duplicate_aadhaar():
    result = await run_all(
        app_id="test-002",
        user_id="user-002",
        pan_number="ABCDE1234F",
        aadhaar_number="1234 5678 9012",
        mobile="9999999999",
        doc_ids=[],
        selfie_embedding=[],
        backend_client=_make_backend(aadhaar_exists=True),
        qdrant_service=_make_qdrant(),
    )

    assert result.fraud_flag is True
    failed_names = [c.check_name for c in result.checks if not c.passed]
    assert "duplicate_aadhaar" in failed_names


# ---------------------------------------------------------------------------
# Hard-fail: face_pool_match
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hard_fail_on_face_pool_match():
    """Qdrant returns a hit belonging to a *different* user — must hard-fail."""

    class _FakePoint:
        payload = {"user_id": "other-user-999"}

    result = await run_all(
        app_id="test-003",
        user_id="user-003",
        pan_number="ZZZZZ0000Z",
        aadhaar_number="0000 0000 0000",
        mobile="1111111111",
        doc_ids=[],
        selfie_embedding=[0.5] * 512,
        backend_client=_make_backend(),
        qdrant_service=_make_qdrant(search_results=[_FakePoint()]),
    )

    assert result.fraud_flag is True
    failed_names = [c.check_name for c in result.checks if not c.passed]
    assert "face_pool_match" in failed_names


# ---------------------------------------------------------------------------
# Confidence calculation: 2 flags out of 5 = 40 %
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fraud_confidence_calculation():
    """duplicate_pan + duplicate_aadhaar = 2/5 = 40.0 %."""
    result = await run_all(
        app_id="test-004",
        user_id="user-004",
        pan_number="XYZAB5678G",
        aadhaar_number="9876 5432 1098",
        mobile="8888888888",
        doc_ids=[],
        selfie_embedding=[],
        backend_client=_make_backend(pan_exists=True, aadhaar_exists=True),
        qdrant_service=_make_qdrant(),
    )

    failed_count = len([c for c in result.checks if not c.passed])
    expected_confidence = round((failed_count / 5) * 100, 2)
    assert result.fraud_confidence == expected_confidence
    assert result.fraud_confidence == 40.0


# ---------------------------------------------------------------------------
# Soft-fail: velocity alone does NOT set fraud_flag
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_soft_fail_no_flag():
    """velocity_flag alone failing should NOT set fraud_flag=True."""
    result = await run_all(
        app_id="test-005",
        user_id="user-005",
        pan_number="LMNOP9012H",
        aadhaar_number="1111 2222 3333",
        mobile="7777777777",
        doc_ids=[],
        selfie_embedding=[],
        backend_client=_make_backend(app_count=5),
        qdrant_service=_make_qdrant(),
    )

    assert result.fraud_flag is False
    failed_names = [c.check_name for c in result.checks if not c.passed]
    assert "velocity_flag" in failed_names
    assert all(n not in HARD_FAIL_CHECKS for n in failed_names)


# ---------------------------------------------------------------------------
# Clean case: 0 flags → fraud_flag=False, confidence=0 %
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_clean_case_no_fraud():
    result = await run_all(
        app_id="test-006",
        user_id="user-006",
        pan_number="CLEAN1234X",
        aadhaar_number="0000 1111 2222",
        mobile="6666666666",
        doc_ids=[],
        selfie_embedding=[],
        backend_client=_make_backend(),
        qdrant_service=_make_qdrant(),
        ocr_income=100_000.0,
        profile_income=105_000.0,  # 5 % deviation — below 40 % threshold
    )

    assert result.fraud_flag is False
    assert result.fraud_confidence == 0.0
    assert all(c.passed for c in result.checks)


# ---------------------------------------------------------------------------
# Income inconsistency: soft-fail only
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_income_inconsistency_soft_fail():
    """Large income gap (>40 %) should flag income_inconsistency but NOT fraud_flag."""
    result = await run_all(
        app_id="test-007",
        user_id="user-007",
        pan_number="INCOM1234Y",
        aadhaar_number="3333 4444 5555",
        mobile="5555555555",
        doc_ids=[],
        selfie_embedding=[],
        backend_client=_make_backend(),
        qdrant_service=_make_qdrant(),
        ocr_income=50_000.0,
        profile_income=100_000.0,  # 50 % deviation
    )

    assert result.fraud_flag is False
    failed_names = [c.check_name for c in result.checks if not c.passed]
    assert "income_inconsistency" in failed_names


# ---------------------------------------------------------------------------
# asyncio.gather is used (checks are collected as a tuple from gather)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_all_checks_run_in_parallel():
    """Verify asyncio.gather is actually called by confirming all 5 checks execute."""
    mock_backend = _make_backend(pan_exists=True, aadhaar_exists=True, app_count=3)
    mock_qdrant = _make_qdrant()

    with patch("app.pipelines.fraud_pipeline.asyncio.gather", wraps=__import__("asyncio").gather) as spy:
        result = await run_all(
            app_id="test-008",
            user_id="user-008",
            pan_number="PARA1234P",
            aadhaar_number="6666 7777 8888",
            mobile="4444444444",
            doc_ids=[],
            selfie_embedding=[],
            backend_client=mock_backend,
            qdrant_service=mock_qdrant,
            ocr_income=200_000.0,
            profile_income=100_000.0,
        )

    spy.assert_called_once()
    assert len(result.checks) == 5


# ---------------------------------------------------------------------------
# run_fraud_checks wrapper returns the canonical dict shape
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_fraud_checks_dict_shape():
    mock_backend = _make_backend(pan_exists=True)
    mock_qdrant = _make_qdrant()

    result = await run_fraud_checks(
        user_id="user-009",
        ocr_data={"pan_number": "ABCDE1234F", "aadhaar_number": "1234 5678 9012", "annual_income": 80_000},
        profile_data={"app_id": "test-009", "annual_income": 82_000, "mobile": "3333333333"},
        backend_client=mock_backend,
        qdrant_service=mock_qdrant,
    )

    assert "user_id" in result
    assert "fraud_flag" in result
    assert "fraud_confidence" in result
    assert "checks" in result
    assert isinstance(result["checks"], dict)
    # Hard-fail must propagate
    assert result["fraud_flag"] is True
    assert result["checks"]["duplicate_pan"] is True
