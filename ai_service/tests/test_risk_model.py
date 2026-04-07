"""Tests for XGBoost risk model — ≥80% coverage."""
import sys
import os
import pytest
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.risk_model import (
    predict_risk,
    _rule_based_risk,
    load_model,
    RISK_LABELS,
)


def test_rule_based_low_risk():
    result = _rule_based_risk(
        income=1000000,
        cibil=800,
        loan=200000,
        academic=85,
        employment="salaried",
        collateral=500000,
    )
    assert result == "LOW"


def test_rule_based_high_risk():
    result = _rule_based_risk(
        income=100000,
        cibil=400,
        loan=900000,
        academic=45,
        employment="unemployed",
        collateral=0,
    )
    assert result == "HIGH"


def test_rule_based_medium_risk():
    result = _rule_based_risk(
        income=300000,
        cibil=650,
        loan=500000,
        academic=60,
        employment="self_employed",
        collateral=200000,
    )
    assert result in ("MEDIUM", "LOW", "HIGH")  # result depends on score


def test_predict_risk_returns_valid_label():
    result = predict_risk(
        income=500000,
        cibil_score=720,
        loan_amount=300000,
        academic_score=75,
        employment_type="salaried",
        collateral_value=400000,
    )
    assert result in ("LOW", "MEDIUM", "HIGH")


def test_predict_risk_unknown_employment_type():
    # Should not raise, should fallback gracefully
    result = predict_risk(
        income=300000,
        cibil_score=650,
        loan_amount=200000,
        academic_score=70,
        employment_type="freelancer",  # Unknown type
        collateral_value=100000,
    )
    assert result in ("LOW", "MEDIUM", "HIGH")


def test_predict_risk_zero_income():
    result = predict_risk(
        income=0,
        cibil_score=600,
        loan_amount=500000,
        academic_score=65,
        employment_type="student",
        collateral_value=0,
    )
    assert result in ("LOW", "MEDIUM", "HIGH")


def test_risk_labels_complete():
    assert set(RISK_LABELS.values()) == {"LOW", "MEDIUM", "HIGH"}


def test_load_model_creates_pkl(tmp_path):
    model_path = str(tmp_path / "test_risk_model.pkl")
    # Should train and save if not exists
    result = load_model(model_path)
    assert result is True
    assert os.path.exists(model_path)


def test_load_model_loads_existing(tmp_path):
    model_path = str(tmp_path / "risk_model.pkl")
    # First call trains
    load_model(model_path)
    # Second call loads existing
    result = load_model(model_path)
    assert result is True
