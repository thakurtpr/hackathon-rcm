"""
XGBoost risk model service — loads risk_model.pkl and provides prediction.
"""
import logging
import os
from pathlib import Path
from typing import Literal, Optional

logger = logging.getLogger(__name__)

_model_bundle = None

RISK_LABELS = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}


def load_model(model_path: Optional[str] = None) -> bool:
    global _model_bundle
    if model_path is None:
        model_path = str(Path(__file__).parent.parent.parent / "models" / "risk_model.pkl")
    if not os.path.exists(model_path):
        logger.warning("risk_model.pkl not found at %s — will train on-the-fly", model_path)
        return _train_and_save(model_path)
    try:
        import joblib
        _model_bundle = joblib.load(model_path)
        logger.info("Risk model loaded from %s", model_path)
        return True
    except Exception as exc:
        logger.error("Failed to load risk model: %s", exc)
        return False


def _train_and_save(model_path: str) -> bool:
    global _model_bundle
    try:
        import numpy as np
        import xgboost as xgb
        import joblib
        from sklearn.preprocessing import LabelEncoder
        from sklearn.model_selection import train_test_split

        logger.info("Training XGBoost risk model on-the-fly...")
        np.random.seed(42)
        n = 2000
        income = np.random.randint(100000, 2000000, n).astype(float)
        cibil = np.random.randint(300, 900, n).astype(float)
        loan = np.random.randint(50000, 2000000, n).astype(float)
        acad = np.random.uniform(40, 100, n)
        emp_types = ["salaried", "self_employed", "student", "unemployed"]
        emp = np.random.choice(emp_types, n)
        collateral = np.random.uniform(0, 5000000, n)

        emp_enc = LabelEncoder()
        emp_enc.fit(emp_types)
        emp_encoded = emp_enc.transform(emp).astype(float)

        X = np.column_stack([income, cibil, loan, acad, emp_encoded, collateral])
        y = np.zeros(n, dtype=int)
        for i in range(n):
            score = 0
            if cibil[i] >= 750: score += 3
            elif cibil[i] >= 650: score += 1
            if income[i] >= 500000: score += 2
            if acad[i] >= 70: score += 2
            if emp[i] == "salaried": score += 2
            if collateral[i] >= loan[i] * 1.5: score += 2
            ratio = loan[i] / max(income[i], 1)
            if ratio <= 2: score += 2
            elif ratio <= 5: score += 1
            if score >= 9: y[i] = 0
            elif score >= 5: y[i] = 1
            else: y[i] = 2

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        model = xgb.XGBClassifier(
            n_estimators=100, max_depth=4, learning_rate=0.1,
            use_label_encoder=False, eval_metric="mlogloss", random_state=42,
        )
        model.fit(X_train, y_train, verbose=False)

        bundle = {
            "model": model,
            "feature_names": ["income", "cibil_score", "loan_amount", "academic_score", "employment_type", "collateral_value"],
            "employment_encoder": emp_enc,
            "label_map": RISK_LABELS,
        }
        Path(model_path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(bundle, model_path)
        _model_bundle = bundle
        logger.info("Risk model trained and saved to %s", model_path)
        return True
    except Exception as exc:
        logger.error("Failed to train risk model: %s", exc)
        return False


def predict_risk(
    income: float,
    cibil_score: float,
    loan_amount: float,
    academic_score: float,
    employment_type: str,
    collateral_value: float,
) -> Literal["LOW", "MEDIUM", "HIGH"]:
    if _model_bundle is None:
        return _rule_based_risk(income, cibil_score, loan_amount, academic_score, employment_type, collateral_value)
    try:
        import numpy as np
        enc = _model_bundle["employment_encoder"]
        model = _model_bundle["model"]
        label_map = _model_bundle["label_map"]

        emp_known = employment_type if employment_type in enc.classes_ else "student"
        emp_encoded = enc.transform([emp_known])[0]

        X = np.array([[income, cibil_score, loan_amount, academic_score, emp_encoded, collateral_value]])
        pred = model.predict(X)[0]
        return label_map.get(int(pred), "MEDIUM")
    except Exception as exc:
        logger.error("Risk prediction failed: %s", exc)
        return _rule_based_risk(income, cibil_score, loan_amount, academic_score, employment_type, collateral_value)


def _rule_based_risk(income, cibil, loan, academic, employment, collateral) -> Literal["LOW", "MEDIUM", "HIGH"]:
    score = 0
    if cibil >= 750: score += 3
    elif cibil >= 650: score += 1
    if income >= 500000: score += 2
    if academic >= 70: score += 2
    if employment == "salaried": score += 2
    if collateral >= loan * 1.5: score += 2
    ratio = loan / max(income, 1)
    if ratio <= 2: score += 2
    elif ratio <= 5: score += 1
    if score >= 9: return "LOW"
    if score >= 5: return "MEDIUM"
    return "HIGH"
