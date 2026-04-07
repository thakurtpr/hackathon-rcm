import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.pipelines.ocr_pipeline import FIELDS_BY_DOC_TYPE


def test_doc_trust_score_formula():
    avg_conf = 0.8
    completeness = 0.75
    trust = round(avg_conf * 0.6 + completeness * 0.4, 4)
    assert trust == 0.78


def test_doc_trust_score_formula_boundary():
    avg_conf = 1.0
    completeness = 1.0
    trust = round(avg_conf * 0.6 + completeness * 0.4, 4)
    assert trust == 1.0

    avg_conf = 0.0
    completeness = 0.0
    trust = round(avg_conf * 0.6 + completeness * 0.4, 4)
    assert trust == 0.0


def test_doc_authentic_threshold():
    def is_authentic(trust: float) -> bool:
        return trust >= 0.5

    assert is_authentic(0.5) is True
    assert is_authentic(0.78) is True
    assert is_authentic(0.499) is False
    assert is_authentic(0.0) is False


def test_fields_by_doc_type_aadhaar():
    fields = FIELDS_BY_DOC_TYPE["aadhaar"]
    assert len(fields) == 5
    assert "name" in fields
    assert "dob" in fields
    assert "aadhaar_last4" in fields


def test_fields_by_doc_type_semester_marksheet():
    fields = FIELDS_BY_DOC_TYPE["semester_marksheet"]
    assert len(fields) == 6
    assert "student_name" in fields
    assert "semester_number" in fields
    assert "sgpa" in fields


def test_fields_by_doc_type_pan():
    fields = FIELDS_BY_DOC_TYPE["pan"]
    assert len(fields) == 3
    assert "pan_number" in fields


def test_fields_by_doc_type_all_present():
    expected_doc_types = {"aadhaar", "pan", "marksheet", "income_cert", "bank_passbook", "semester_marksheet"}
    for dt in expected_doc_types:
        assert dt in FIELDS_BY_DOC_TYPE, f"Missing doc type: {dt}"
        assert len(FIELDS_BY_DOC_TYPE[dt]) > 0, f"Empty fields for {dt}"
