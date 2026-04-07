"""
Train XGBoost risk model and save to models/risk_model.pkl
Features: income, cibil_score, loan_amount, academic_score, employment_type, collateral_value
Target: risk_band (LOW=0, MEDIUM=1, HIGH=2)
"""
import os
import sys
import numpy as np
import joblib
from pathlib import Path

def train():
    try:
        import xgboost as xgb
        from sklearn.preprocessing import LabelEncoder
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import classification_report
    except ImportError as e:
        print(f"Missing dependency: {e}. Install with: pip install xgboost scikit-learn")
        sys.exit(1)

    np.random.seed(42)
    n = 2000

    # Synthetic training data
    income = np.random.randint(100000, 2000000, n)
    cibil_score = np.random.randint(300, 900, n)
    loan_amount = np.random.randint(50000, 2000000, n)
    academic_score = np.random.uniform(40, 100, n)
    employment_types = ["salaried", "self_employed", "student", "unemployed"]
    employment_type = np.random.choice(employment_types, n)
    collateral_value = np.random.uniform(0, 5000000, n)

    # Encode employment_type
    emp_enc = LabelEncoder()
    emp_encoded = emp_enc.fit_transform(employment_type)

    X = np.column_stack([income, cibil_score, loan_amount, academic_score, emp_encoded, collateral_value])

    # Risk band logic: HIGH=0, MEDIUM=1, LOW=2 based on features
    risk_raw = np.zeros(n, dtype=int)
    for i in range(n):
        score = 0
        if cibil_score[i] >= 750: score += 3
        elif cibil_score[i] >= 650: score += 1
        if income[i] >= 500000: score += 2
        if academic_score[i] >= 70: score += 2
        if employment_type[i] == "salaried": score += 2
        if collateral_value[i] >= loan_amount[i] * 1.5: score += 2
        ratio = loan_amount[i] / max(income[i], 1)
        if ratio <= 2: score += 2
        elif ratio <= 5: score += 1

        if score >= 9: risk_raw[i] = 0    # LOW
        elif score >= 5: risk_raw[i] = 1  # MEDIUM
        else: risk_raw[i] = 2             # HIGH

    y = risk_raw

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        use_label_encoder=False,
        eval_metric="mlogloss",
        random_state=42,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred, target_names=["LOW", "MEDIUM", "HIGH"]))

    models_dir = Path(__file__).parent.parent / "models"
    models_dir.mkdir(exist_ok=True)
    model_path = models_dir / "risk_model.pkl"

    joblib.dump({
        "model": model,
        "feature_names": ["income", "cibil_score", "loan_amount", "academic_score", "employment_type", "collateral_value"],
        "employment_encoder": emp_enc,
        "label_map": {0: "LOW", 1: "MEDIUM", 2: "HIGH"},
    }, model_path)

    print(f"Model saved to {model_path}")
    return model_path

if __name__ == "__main__":
    train()
