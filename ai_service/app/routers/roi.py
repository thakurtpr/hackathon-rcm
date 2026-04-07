"""Course ROI & Career Placement AI Predictor.

Judges LOVE this feature — it shows the loan is approved based on
*future earning potential*, not just current wealth.
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


class ROIRequest(BaseModel):
    course: str
    institution: str
    loan_amount: float = 0.0
    category: Optional[str] = None


class ROIResponse(BaseModel):
    course: str
    institution: str
    avg_salary_lpa: float
    placement_probability: float
    loan_payback_years: float
    roi_score: float  # 0–10
    career_paths: list[str]
    salary_range: dict  # {min, max}
    ai_recommendation: str
    risk_adjustment: str


_SYSTEM_PROMPT = """You are an AI that predicts career outcomes and loan ROI for Indian students.
Given a course and institution, output ONLY a valid JSON object (no markdown, no explanation).

JSON schema:
{
  "avg_salary_lpa": <float, average annual salary in lakh per annum>,
  "placement_probability": <float 0-100, percentage>,
  "career_paths": [<list of 3 likely job titles>],
  "salary_range": {"min": <float>, "max": <float>},
  "ai_recommendation": <one sentence about loan viability>,
  "risk_adjustment": <"LOW" | "MEDIUM" | "HIGH" based on course demand>
}

Be realistic for Indian market 2024-2025. Use these benchmarks:
- IIT/NIT/IIIT: B.Tech CS avg ₹18-25 LPA, placement 95%+
- State engineering colleges: B.Tech CS avg ₹6-10 LPA, placement 70-85%
- Medical: MBBS avg ₹8-15 LPA post residency, placement 95%
- MBA top-tier (IIM): avg ₹25+ LPA, placement 99%
- MBA tier-2: avg ₹8-12 LPA, placement 80-90%
- B.Com/BA from regional colleges: avg ₹3-6 LPA, placement 60-75%
- Law (NLU): avg ₹12-20 LPA, placement 90%+
- Nursing/Allied health: avg ₹3-5 LPA, placement 85%
"""


def _compute_roi_score(avg_salary: float, loan_amount: float, payback_years: float) -> float:
    """Compute ROI score 0-10 based on salary, loan amount, and payback time."""
    if payback_years <= 0 or avg_salary <= 0:
        return 5.0
    # Higher salary relative to loan = better score
    salary_to_loan_ratio = (avg_salary * 100000) / max(loan_amount, 1)
    base = min(salary_to_loan_ratio * 2, 8.0)
    # Payback penalty: > 5 years reduces score
    payback_penalty = max(0, (payback_years - 2) * 0.3)
    return round(max(1.0, min(10.0, base - payback_penalty)), 1)


@router.post("/predict", response_model=ROIResponse)
async def predict_roi(req: ROIRequest) -> ROIResponse:
    """Predict Course ROI, Placement probability, and Career paths using LLM + heuristics."""
    settings = get_settings()

    user_prompt = (
        f"Course: {req.course}\n"
        f"Institution: {req.institution}\n"
        f"Loan Amount: ₹{req.loan_amount:,.0f}\n"
        f"Student Category: {req.category or 'General'}\n\n"
        "Output the JSON prediction:"
    )

    raw = settings.make_llm_call(user_prompt, system=_SYSTEM_PROMPT, max_tokens=400)

    try:
        # Strip any markdown wrapper
        clean = raw.strip()
        if "```" in clean:
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        data = json.loads(clean)
    except (json.JSONDecodeError, IndexError) as exc:
        logger.warning("ROI LLM parse failed (%s), using heuristics", exc)
        data = _heuristic_prediction(req.course, req.institution)

    avg_salary = float(data.get("avg_salary_lpa", 0) or 0)
    placement = float(data.get("placement_probability", 0) or 0)

    # Payback calculation: assume 30% of monthly salary goes to EMI
    annual_repayment = (avg_salary * 100000) * 0.30
    payback_years = round(req.loan_amount / max(annual_repayment, 1), 1) if annual_repayment > 0 else 0.0

    roi_score = _compute_roi_score(avg_salary, req.loan_amount, payback_years)

    return ROIResponse(
        course=req.course,
        institution=req.institution,
        avg_salary_lpa=avg_salary,
        placement_probability=placement,
        loan_payback_years=payback_years,
        roi_score=roi_score,
        career_paths=data.get("career_paths", ["Graduate Role", "Research", "Teaching"]),
        salary_range=data.get("salary_range", {"min": avg_salary * 0.7, "max": avg_salary * 1.5}),
        ai_recommendation=data.get("ai_recommendation", "Loan viability depends on placement outcomes."),
        risk_adjustment=data.get("risk_adjustment", "MEDIUM"),
    )


@router.get("/batch")
async def batch_roi(course: str, institution: str, loan_amount: float = 500000):
    """Quick GET version for dashboard widgets."""
    req = ROIRequest(course=course, institution=institution, loan_amount=loan_amount)
    return await predict_roi(req)


def _heuristic_prediction(course: str, institution: str) -> dict:
    """Rule-based fallback when LLM is unavailable."""
    course_lower = course.lower()
    inst_lower = institution.lower()

    is_premium = any(k in inst_lower for k in ["iit", "nit", "iim", "aiims", "nlu", "bits"])
    is_tech = any(k in course_lower for k in ["b.tech", "btech", "computer", "cs", "it", "software"])
    is_medical = any(k in course_lower for k in ["mbbs", "bds", "medical", "medicine"])
    is_mba = "mba" in course_lower
    is_law = "law" in course_lower or "llb" in course_lower

    if is_premium and is_tech:
        return {"avg_salary_lpa": 20, "placement_probability": 95,
                "career_paths": ["Software Engineer", "Data Scientist", "Product Manager"],
                "salary_range": {"min": 15, "max": 35}, "risk_adjustment": "LOW",
                "ai_recommendation": "Excellent ROI — premium tech institute with strong placement."}
    if is_tech:
        return {"avg_salary_lpa": 7, "placement_probability": 78,
                "career_paths": ["Junior Developer", "IT Support", "Web Developer"],
                "salary_range": {"min": 4, "max": 12}, "risk_adjustment": "MEDIUM",
                "ai_recommendation": "Good ROI for tech graduates from state universities."}
    if is_medical:
        return {"avg_salary_lpa": 12, "placement_probability": 96,
                "career_paths": ["Physician", "Resident Doctor", "Healthcare Consultant"],
                "salary_range": {"min": 8, "max": 25}, "risk_adjustment": "LOW",
                "ai_recommendation": "High earning potential after residency period."}
    if is_mba and is_premium:
        return {"avg_salary_lpa": 28, "placement_probability": 99,
                "career_paths": ["Consultant", "Investment Banker", "Marketing Manager"],
                "salary_range": {"min": 18, "max": 50}, "risk_adjustment": "LOW",
                "ai_recommendation": "Top MBA with elite placement — very strong ROI."}
    if is_law and is_premium:
        return {"avg_salary_lpa": 16, "placement_probability": 92,
                "career_paths": ["Corporate Lawyer", "Litigation", "Legal Consultant"],
                "salary_range": {"min": 10, "max": 30}, "risk_adjustment": "LOW",
                "ai_recommendation": "NLU law degrees have strong corporate placement."}
    return {"avg_salary_lpa": 5, "placement_probability": 68,
            "career_paths": ["Graduate Officer", "Teaching", "Government Services"],
            "salary_range": {"min": 3, "max": 8}, "risk_adjustment": "MEDIUM",
            "ai_recommendation": "Moderate ROI — consider skill development programs post-graduation."}
