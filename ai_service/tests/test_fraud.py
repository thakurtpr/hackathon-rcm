import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.responses import FraudCheck, FraudResult
from app.pipelines.fraud_pipeline import run_all, HARD_FAIL_CHECKS


@pytest.mark.asyncio
async def test_hard_fail_on_duplicate_pan():
    mock_backend = AsyncMock()
    mock_backend.check_pan = AsyncMock(return_value=True)
    mock_backend.check_aadhaar = AsyncMock(return_value=False)
    mock_backend.get_app_count = AsyncMock(return_value=0)
    mock_backend.get_document_status = AsyncMock(return_value={"tamper_flag": False})

    mock_qdrant = AsyncMock()
    mock_qdrant.search = AsyncMock(return_value=[])

    result = await run_all(
        app_id="test-001",
        user_id="user-001",
        pan_number="ABCDE1234F",
        aadhaar_number="1234 5678 9012",
        mobile="9999999999",
        doc_ids=[],
        selfie_embedding=[0.1] * 512,
        backend_client=mock_backend,
        qdrant_service=mock_qdrant,
    )

    assert result.fraud_flag is True
    failed_names = [c.check_name for c in result.checks if not c.passed]
    assert "duplicate_pan" in failed_names


@pytest.mark.asyncio
async def test_fraud_confidence_calculation():
    mock_backend = AsyncMock()
    mock_backend.check_pan = AsyncMock(return_value=True)
    mock_backend.check_aadhaar = AsyncMock(return_value=True)
    mock_backend.get_app_count = AsyncMock(return_value=0)
    mock_backend.get_document_status = AsyncMock(return_value={"tamper_flag": False})

    mock_qdrant = AsyncMock()
    mock_qdrant.search = AsyncMock(return_value=[])

    result = await run_all(
        app_id="test-002",
        user_id="user-002",
        pan_number="XYZAB5678G",
        aadhaar_number="9876 5432 1098",
        mobile="8888888888",
        doc_ids=[],
        selfie_embedding=[],
        backend_client=mock_backend,
        qdrant_service=mock_qdrant,
    )

    failed_count = len([c for c in result.checks if not c.passed])
    expected_confidence = round((failed_count / 5) * 100, 2)
    assert result.fraud_confidence == expected_confidence


@pytest.mark.asyncio
async def test_soft_fail_no_flag():
    """velocity_check alone failing should NOT set fraud_flag=True."""
    mock_backend = AsyncMock()
    mock_backend.check_pan = AsyncMock(return_value=False)
    mock_backend.check_aadhaar = AsyncMock(return_value=False)
    mock_backend.get_app_count = AsyncMock(return_value=5)
    mock_backend.get_document_status = AsyncMock(return_value={"tamper_flag": False})

    mock_qdrant = AsyncMock()
    mock_qdrant.search = AsyncMock(return_value=[])

    result = await run_all(
        app_id="test-003",
        user_id="user-003",
        pan_number="LMNOP9012H",
        aadhaar_number="1111 2222 3333",
        mobile="7777777777",
        doc_ids=[],
        selfie_embedding=[],
        backend_client=mock_backend,
        qdrant_service=mock_qdrant,
    )

    assert result.fraud_flag is False
    failed_names = [c.check_name for c in result.checks if not c.passed]
    assert "velocity_check" in failed_names
    assert all(n not in HARD_FAIL_CHECKS for n in failed_names)
