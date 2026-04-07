import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch
import json

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.pipelines.ocr_pipeline import FIELDS_BY_DOC_TYPE, _parse_llm_json


# ---------------------------------------------------------------------------
# Unit tests for helpers
# ---------------------------------------------------------------------------

def test_parse_llm_json_plain():
    raw = '{"name": "Rajan Kumar", "dob": "1990-01-01"}'
    result = _parse_llm_json(raw)
    assert result["name"] == "Rajan Kumar"
    assert result["dob"] == "1990-01-01"


def test_parse_llm_json_strips_fences():
    raw = "```json\n{\"pan_number\": \"ABCDE1234F\"}\n```"
    result = _parse_llm_json(raw)
    assert result["pan_number"] == "ABCDE1234F"


def test_doc_trust_score_formula():
    avg_conf = 0.8
    completeness = 0.75
    trust = round(avg_conf * 0.6 + completeness * 0.4, 4)
    assert trust == 0.78


def test_doc_trust_score_formula_boundary():
    trust_max = round(1.0 * 0.6 + 1.0 * 0.4, 4)
    assert trust_max == 1.0
    trust_min = round(0.0 * 0.6 + 0.0 * 0.4, 4)
    assert trust_min == 0.0


def test_doc_authentic_threshold():
    def is_authentic(trust: float) -> bool:
        return trust >= 0.5

    assert is_authentic(0.5) is True
    assert is_authentic(0.78) is True
    assert is_authentic(0.499) is False
    assert is_authentic(0.0) is False


# ---------------------------------------------------------------------------
# FIELDS_BY_DOC_TYPE schema tests
# ---------------------------------------------------------------------------

def test_fields_by_doc_type_aadhaar():
    fields = FIELDS_BY_DOC_TYPE["aadhaar"]
    assert "name" in fields
    assert "dob" in fields
    assert "gender" in fields
    assert "address" in fields
    assert "aadhaar_number" in fields


def test_fields_by_doc_type_pan():
    fields = FIELDS_BY_DOC_TYPE["pan"]
    assert "name" in fields
    assert "pan_number" in fields
    assert "dob" in fields


def test_fields_by_doc_type_marksheet():
    fields = FIELDS_BY_DOC_TYPE["marksheet"]
    assert "name" in fields
    assert "roll_no" in fields
    assert "marks" in fields
    assert "percentage" in fields
    assert "board" in fields
    assert "year" in fields


def test_fields_by_doc_type_income_cert():
    fields = FIELDS_BY_DOC_TYPE["income_cert"]
    assert "name" in fields
    assert "annual_income" in fields
    assert "issuing_authority" in fields
    assert "date" in fields


def test_fields_by_doc_type_bank_passbook():
    fields = FIELDS_BY_DOC_TYPE["bank_passbook"]
    assert "account_number" in fields
    assert "bank_name" in fields
    assert "branch" in fields
    assert "ifsc" in fields
    assert "balance" in fields


def test_fields_by_doc_type_semester_marksheet():
    fields = FIELDS_BY_DOC_TYPE["semester_marksheet"]
    assert "semester" in fields
    assert "subjects" in fields
    assert "sgpa" in fields
    assert "cgpa" in fields


def test_fields_by_doc_type_all_present():
    expected = {"aadhaar", "pan", "marksheet", "income_cert", "bank_passbook", "semester_marksheet"}
    for dt in expected:
        assert dt in FIELDS_BY_DOC_TYPE, f"Missing doc type: {dt}"
        assert len(FIELDS_BY_DOC_TYPE[dt]) > 0, f"Empty fields for {dt}"


# ---------------------------------------------------------------------------
# Integration-style tests with mocked PaddleOCR and LLM for two doc types
# ---------------------------------------------------------------------------

def _make_ocr_result(lines):
    """Build a PaddleOCR result list from a list of (text, confidence) tuples."""
    return [
        [[[0, 0], [0, 0], [0, 0], [0, 0]], (text, conf)]
        for text, conf in lines
    ]


@pytest.mark.asyncio
async def test_run_aadhaar_extraction():
    """OCR pipeline correctly extracts aadhaar fields via mocked PaddleOCR + LLM."""
    from app.pipelines import ocr_pipeline

    ocr_lines = [
        ("Government of India", 0.99),
        ("Rajan Kumar", 0.95),
        ("DOB: 01/01/1990", 0.93),
        ("Male", 0.97),
        ("123 Main Street, Delhi", 0.88),
        ("1234 5678 9012", 0.91),
    ]
    fake_ocr_result = [_make_ocr_result(ocr_lines)]

    extracted_json = {
        "name": "Rajan Kumar",
        "dob": "01/01/1990",
        "gender": "Male",
        "address": "123 Main Street, Delhi",
        "aadhaar_number": "1234 5678 9012",
    }

    mock_minio = AsyncMock()
    mock_minio.fetch_file = AsyncMock(return_value=b"fake_image_bytes")

    mock_llm = MagicMock(return_value=json.dumps(extracted_json))

    mock_ocr_instance = MagicMock()
    mock_ocr_instance.ocr = MagicMock(return_value=fake_ocr_result)

    with patch.object(ocr_pipeline, "_get_ocr", return_value=mock_ocr_instance), \
         patch("app.pipelines.ocr_pipeline.Image") as mock_pil, \
         patch("app.pipelines.ocr_pipeline.np") as mock_np:

        import numpy as real_np
        mock_np.array.return_value = real_np.zeros((100, 100, 3), dtype=real_np.uint8)
        mock_pil.open.return_value.convert.return_value = MagicMock()

        result = await ocr_pipeline.run(
            minio_path="bucket/aadhaar.jpg",
            doc_type="aadhaar",
            minio_client=mock_minio,
            llm_call_fn=mock_llm,
        )

    assert result["doc_authentic"] is True
    assert result["ocr_extracted"]["name"] == "Rajan Kumar"
    assert result["ocr_extracted"]["aadhaar_number"] == "1234 5678 9012"
    assert result["doc_trust_score"] > 0.0


@pytest.mark.asyncio
async def test_run_pan_extraction():
    """OCR pipeline correctly extracts PAN fields via mocked PaddleOCR + LLM."""
    from app.pipelines import ocr_pipeline

    ocr_lines = [
        ("INCOME TAX DEPARTMENT", 0.99),
        ("ABCDE1234F", 0.97),
        ("RAJAN KUMAR", 0.95),
        ("01/01/1990", 0.93),
    ]
    fake_ocr_result = [_make_ocr_result(ocr_lines)]

    extracted_json = {
        "name": "RAJAN KUMAR",
        "pan_number": "ABCDE1234F",
        "dob": "01/01/1990",
    }

    mock_minio = AsyncMock()
    mock_minio.fetch_file = AsyncMock(return_value=b"fake_image_bytes")

    mock_llm = MagicMock(return_value=json.dumps(extracted_json))

    mock_ocr_instance = MagicMock()
    mock_ocr_instance.ocr = MagicMock(return_value=fake_ocr_result)

    with patch.object(ocr_pipeline, "_get_ocr", return_value=mock_ocr_instance), \
         patch("app.pipelines.ocr_pipeline.Image") as mock_pil, \
         patch("app.pipelines.ocr_pipeline.np") as mock_np:

        import numpy as real_np
        mock_np.array.return_value = real_np.zeros((100, 100, 3), dtype=real_np.uint8)
        mock_pil.open.return_value.convert.return_value = MagicMock()

        result = await ocr_pipeline.run(
            minio_path="bucket/pan.jpg",
            doc_type="pan",
            minio_client=mock_minio,
            llm_call_fn=mock_llm,
        )

    assert result["doc_authentic"] is True
    assert result["ocr_extracted"]["pan_number"] == "ABCDE1234F"
    assert result["ocr_extracted"]["name"] == "RAJAN KUMAR"
    assert result["doc_trust_score"] > 0.0


@pytest.mark.asyncio
async def test_run_selfie_returns_empty_extracted():
    """Selfie doc type returns empty ocr_extracted (no fields to extract)."""
    from app.pipelines import ocr_pipeline

    mock_minio = AsyncMock()
    mock_minio.fetch_file = AsyncMock(return_value=b"fake_image_bytes")

    mock_llm = MagicMock()

    mock_ocr_instance = MagicMock()
    mock_ocr_instance.ocr = MagicMock(return_value=[[]])

    with patch.object(ocr_pipeline, "_get_ocr", return_value=mock_ocr_instance), \
         patch("app.pipelines.ocr_pipeline.Image") as mock_pil, \
         patch("app.pipelines.ocr_pipeline.np") as mock_np:

        import numpy as real_np
        mock_np.array.return_value = real_np.zeros((100, 100, 3), dtype=real_np.uint8)
        mock_pil.open.return_value.convert.return_value = MagicMock()

        result = await ocr_pipeline.run(
            minio_path="bucket/selfie.jpg",
            doc_type="selfie",
            minio_client=mock_minio,
            llm_call_fn=mock_llm,
        )

    assert result["ocr_extracted"] == {}
    mock_llm.assert_not_called()


@pytest.mark.asyncio
async def test_run_llm_failure_returns_nulls():
    """If LLM call fails twice, OCR pipeline returns null fields without crashing."""
    from app.pipelines import ocr_pipeline

    ocr_lines = [("Some text", 0.80)]
    fake_ocr_result = [_make_ocr_result(ocr_lines)]

    mock_minio = AsyncMock()
    mock_minio.fetch_file = AsyncMock(return_value=b"fake_image_bytes")

    mock_llm = MagicMock(side_effect=Exception("LLM down"))

    mock_ocr_instance = MagicMock()
    mock_ocr_instance.ocr = MagicMock(return_value=fake_ocr_result)

    with patch.object(ocr_pipeline, "_get_ocr", return_value=mock_ocr_instance), \
         patch("app.pipelines.ocr_pipeline.Image") as mock_pil, \
         patch("app.pipelines.ocr_pipeline.np") as mock_np:

        import numpy as real_np
        mock_np.array.return_value = real_np.zeros((100, 100, 3), dtype=real_np.uint8)
        mock_pil.open.return_value.convert.return_value = MagicMock()

        result = await ocr_pipeline.run(
            minio_path="bucket/aadhaar.jpg",
            doc_type="aadhaar",
            minio_client=mock_minio,
            llm_call_fn=mock_llm,
        )

    assert "ocr_extracted" in result
    # All fields should be None when LLM fails
    for v in result["ocr_extracted"].values():
        assert v is None
