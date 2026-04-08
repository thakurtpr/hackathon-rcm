import hashlib
import json
import logging
import os
import re
from datetime import date
from typing import Callable

from app.models.requests import AnswerItem
from app.models.responses import BehavioralResult, DimensionScores
from app.prompts.question_generation import _build_question_generation_prompt
from app.prompts.answer_scoring import ANSWER_SCORING_PROMPT

logger = logging.getLogger(__name__)

_groq_key = os.environ.get("GROQ_API_KEY", "")
if _groq_key:
    logger.info("GROQ_API_KEY loaded: %s...", _groq_key[:8])
else:
    logger.warning("GROQ_API_KEY not set — behavioral questions will use Ollama or return 503")

DIMENSION_WEIGHTS = {
    "financial_responsibility": 0.20,
    "resilience": 0.20,
    "goal_clarity": 0.20,
    "risk_awareness": 0.15,
    "initiative": 0.15,
    "social_capital": 0.10,
}

DIMENSION_KEY_MAP = {
    "financial_responsibility": "fin_resp",
    "resilience": "resilience",
    "goal_clarity": "goal_clarity",
    "risk_awareness": "risk_aware",
    "initiative": "initiative",
    "social_capital": "social_cap",
}

_MCQ_RUBRIC_PATH = os.path.join(os.path.dirname(__file__), "../prompts/mcq_rubric.json")


def _load_mcq_rubric() -> dict:
    with open(_MCQ_RUBRIC_PATH) as f:
        return json.load(f)


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    return json.loads(raw)


def _parse_json_array(raw: str) -> list:
    raw = raw.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    parsed = json.loads(raw)
    # Groq json_object mode wraps the array in a dict — unwrap it
    if isinstance(parsed, dict):
        for v in parsed.values():
            if isinstance(v, list):
                return v
        return []
    return parsed


def _compute_age(dob: str) -> int:
    try:
        parts = dob.replace("/", "-").split("-")
        if len(parts) == 3:
            year = int(parts[0]) if len(parts[0]) == 4 else int(parts[2])
            return date.today().year - year
    except Exception:
        pass
    return 20


def _build_profile_context(profile: dict) -> str:
    age = _compute_age(profile.get("dob", "2004-01-01"))

    # Support both old API keys (annual_income, percentage) and new conv_data keys
    # (family_income as band string, last_percentage)
    name = profile.get("full_name") or "Student"
    course = profile.get("course") or "Unknown course"
    institution = profile.get("institution") or "Unknown institution"
    category = (profile.get("category") or "general").upper()
    nirf_rank = profile.get("nirf_rank") or "unranked"
    loan_tenure = profile.get("loan_tenure") or 5
    gender = profile.get("gender") or "unknown"
    current_year = profile.get("current_year") or ""

    # Academic score: prefer last_percentage (new key) over percentage (old key)
    percentage = profile.get("last_percentage") or profile.get("percentage") or "0"

    # Loan amount: direct value (new key is also "loan_amount")
    loan_amount = profile.get("loan_amount") or "0"

    # Income: new key is "family_income" (band string); old key is "annual_income" (int)
    _income_band_labels = {
        "under_1l":   "Under ₹1 lakh per year (very low income)",
        "1l_to_3l":   "₹1–3 lakh per year (low income)",
        "3l_to_6l":   "₹3–6 lakh per year (lower-middle income)",
        "6l_to_10l":  "₹6–10 lakh per year (middle income)",
        "above_10l":  "Above ₹10 lakh per year (upper-middle income)",
    }
    raw_income = profile.get("family_income") or ""
    income_str = _income_band_labels.get(raw_income, "")
    if not income_str:
        annual = profile.get("annual_income") or 0
        income_str = f"₹{annual:,} per year" if annual else "Not specified"

    # State detection from institution name if not explicit
    state = profile.get("state") or ""
    if not state:
        inst_lower = institution.lower()
        if any(k in inst_lower for k in [
            "odisha", "odia", "bhubaneswar", "cuttack", "rourkela",
            "sambalpur", "berhampur", "ravenshaw", "utkal", "veer surendra",
        ]):
            state = "Odisha"
        elif any(k in inst_lower for k in ["mumbai", "pune", "nagpur", "maharashtra", "aurangabad"]):
            state = "Maharashtra"
        elif any(k in inst_lower for k in ["delhi", "new delhi", "dwarka"]):
            state = "Delhi"
        elif any(k in inst_lower for k in ["bengaluru", "bangalore", "mysore", "karnataka"]):
            state = "Karnataka"
        elif any(k in inst_lower for k in ["chennai", "madurai", "tamil", "coimbatore", "trichy"]):
            state = "Tamil Nadu"
        elif any(k in inst_lower for k in ["hyderabad", "telangana", "warangal"]):
            state = "Telangana"
        elif any(k in inst_lower for k in ["kolkata", "west bengal", "jadavpur", "presidency"]):
            state = "West Bengal"
        elif any(k in inst_lower for k in ["ahmedabad", "gujarat", "vadodara", "surat"]):
            state = "Gujarat"
    state = state or "India"

    year_info = f", currently in {current_year} year" if current_year else ""

    return (
        f"Student Name: {name}. Age: {age} years{year_info}. "
        f"Course: {course} at {institution} (NIRF rank: {nirf_rank}) in {state}. "
        f"Annual Family Income: {income_str}. "
        f"Academic Performance: {percentage}% or equivalent CGPA. "
        f"Category: {category}. "
        f"Loan Amount Requested: ₹{loan_amount} for {loan_tenure} years. "
        f"Gender: {gender}."
    )


def _validate_questions(questions: list) -> bool:
    if len(questions) != 8:
        return False
    required_keys = {"question_id", "question_text", "type", "dimension"}
    for q in questions:
        if not required_keys.issubset(q.keys()):
            return False
        if q["type"] == "mcq" and (not q.get("options") or len(q["options"]) != 4):
            return False
    return True


def _fallback_questions() -> list:
    """Return 8 generic behavioral questions when AI generation is unavailable."""
    return [
        {
            "question_id": "q1",
            "question_text": "You receive your education loan disbursement of ₹2 lakhs. What is the first thing you do with the money?",
            "type": "mcq",
            "options": [
                "Use a large portion for personal expenses and entertainment",
                "Keep it all in savings and worry about fees later",
                "Pay tuition and hostel fees immediately, keep rest for books and transport",
                "Invest it all in stocks to grow the money before using it"
            ],
            "dimension": "financial_responsibility"
        },
        {
            "question_id": "q2",
            "question_text": "Describe a time when you faced a major setback — academically, personally, or financially — and how you recovered from it. What did you learn about yourself?",
            "type": "free_text",
            "options": None,
            "dimension": "resilience"
        },
        {
            "question_id": "q3",
            "question_text": "Where do you see yourself 5 years after completing your current course? Describe your career plan and how this education loan will help you get there.",
            "type": "free_text",
            "options": None,
            "dimension": "goal_clarity"
        },
        {
            "question_id": "q4",
            "question_text": "You graduate and get a job offer with a salary of ₹3.5 LPA. Your EMI for the education loan is ₹8,000/month. What do you do?",
            "type": "mcq",
            "options": [
                "Request a loan moratorium extension and delay payments",
                "Pay only the minimum EMI and ignore the rest",
                "Start paying the EMI immediately and budget carefully",
                "Ask family to pay it while you save your salary"
            ],
            "dimension": "risk_awareness"
        },
        {
            "question_id": "q5",
            "question_text": "If the interest rate on your education loan increases by 1% next year, what is your reaction?",
            "type": "mcq",
            "options": [
                "Panic and consider dropping out to avoid more debt",
                "Ignore it — interest rates don't affect me",
                "Calculate the impact and see if I need to adjust my budget",
                "Immediately prepay the loan fully, even if it strains my finances"
            ],
            "dimension": "risk_awareness"
        },
        {
            "question_id": "q6",
            "question_text": "You hear about a free certification course in your field that would boost your resume, but it requires 2 hours daily for 3 months. You already have a heavy academic load. What do you do?",
            "type": "mcq",
            "options": [
                "Skip it — I already have too much to do",
                "Sign up but drop it after the first week",
                "Plan a weekly schedule to fit it in without failing my exams",
                "Do it half-heartedly while skipping regular classes"
            ],
            "dimension": "initiative"
        },
        {
            "question_id": "q7",
            "question_text": "Your college placement cell announces a workshop on resume writing and interview skills. It's on a Saturday when you had personal plans. What do you do?",
            "type": "mcq",
            "options": [
                "Skip it — weekends are personal time",
                "Attend briefly and leave early",
                "Attend fully and actively participate",
                "Ask a friend to attend and share notes"
            ],
            "dimension": "initiative"
        },
        {
            "question_id": "q8",
            "question_text": "Your family is struggling financially and asks you to contribute from your loan disbursement. How do you handle this situation?",
            "type": "mcq",
            "options": [
                "Give all of it — family comes first, I'll figure out fees later",
                "Refuse completely — this money is only for my education",
                "Have an honest conversation, help with a small amount, and explain the loan terms",
                "Hide the money so the family doesn't ask"
            ],
            "dimension": "social_capital"
        },
    ]


async def generate_questions(
    profile: dict,
    app_id: str,
    redis_service,
    llm_call_fn: Callable[[str], str],
    force_refresh: bool = False,
) -> list:
    if not force_refresh:
        cached = await redis_service.get_json(f"questions:{app_id}")
        if cached:
            logger.info("Returning cached questions for app_id=%s", app_id)
            return cached

    profile_context = _build_profile_context(profile)
    prompt = _build_question_generation_prompt(profile_context)

    questions = []
    original_prompt = prompt
    for attempt in range(2):
        try:
            raw = llm_call_fn(prompt)
            questions = _parse_json_array(raw)
            if _validate_questions(questions):
                break
            if attempt == 0:
                prompt = (
                    "Your previous response was invalid. "
                    "Return ONLY a valid JSON array of exactly 8 question objects with fields: "
                    "question_id, question_text, type, options, dimension. "
                    "Options must be a list of 4 strings for mcq, null for free_text. "
                    "Dimensions: financial_responsibility, resilience, goal_clarity, risk_awareness, initiative, social_capital. "
                    f"Original context:\n{original_prompt}"
                )
        except Exception as exc:
            logger.warning("Question generation attempt %d failed: %s", attempt + 1, exc)
            questions = []

    if not _validate_questions(questions):
        raise RuntimeError(
            "AI question generation failed after 2 attempts. "
            "Check GROQ_API_KEY and Groq service availability."
        )

    await redis_service.set_json(f"questions:{app_id}", questions, ttl=3600)
    logger.info("Generated and cached fresh questions for app_id=%s", app_id)
    return questions


async def score_answers(
    app_id: str,
    answers: list,
    redis_service,
    llm_call_fn: Callable[[str], str],
) -> BehavioralResult:
    questions_raw = await redis_service.get_json(f"questions:{app_id}")
    if questions_raw is None:
        raise ValueError(f"Questions not found for app_id: {app_id}")

    rubric = _load_mcq_rubric()
    option_scores = rubric["option_index_to_score"]

    question_lookup = {q["question_id"]: q for q in questions_raw}

    dimension_scores_raw: dict[str, list[float]] = {dim: [] for dim in DIMENSION_WEIGHTS}

    for answer in answers:
        qid = answer.question_id if hasattr(answer, "question_id") else answer["question_id"]
        ans_val = answer.answer if hasattr(answer, "answer") else answer["answer"]
        q = question_lookup.get(qid)
        if not q:
            continue

        q_type = q.get("type", "free_text")
        dimension = q.get("dimension", "resilience")

        if q_type == "mcq":
            score = float(option_scores.get(str(ans_val), 0))
        else:
            score = _score_free_text(ans_val, q, dimension, llm_call_fn)

        if dimension in dimension_scores_raw:
            dimension_scores_raw[dimension].append(score)

    dim_averages: dict[str, float] = {}
    for dim, scores in dimension_scores_raw.items():
        dim_averages[dim] = sum(scores) / len(scores) if scores else 50.0

    pq_score = sum(
        dim_averages.get(dim, 50.0) * weight
        for dim, weight in DIMENSION_WEIGHTS.items()
    )
    pq_score = round(min(100.0, max(0.0, pq_score)), 2)

    total_time = sum(
        (a.time_taken_seconds if hasattr(a, "time_taken_seconds") else a.get("time_taken_seconds", 30))
        for a in answers
    )
    time_flags = ["suspiciously_fast"] if total_time < 60 else []

    question_hash = hashlib.sha256(
        ",".join(sorted(q["question_id"] for q in questions_raw)).encode()
    ).hexdigest()

    return BehavioralResult(
        app_id=app_id,
        pq_score=pq_score,
        dimension_scores=DimensionScores(
            fin_resp=round(dim_averages.get("financial_responsibility", 50.0), 2),
            resilience=round(dim_averages.get("resilience", 50.0), 2),
            goal_clarity=round(dim_averages.get("goal_clarity", 50.0), 2),
            risk_aware=round(dim_averages.get("risk_awareness", 50.0), 2),
            initiative=round(dim_averages.get("initiative", 50.0), 2),
            social_cap=round(dim_averages.get("social_capital", 50.0), 2),
        ),
        question_hash=question_hash,
        time_flags=time_flags,
    )


def _score_free_text(answer_text: str, question: dict, dimension: str, llm_call_fn: Callable) -> float:
    prompt = ANSWER_SCORING_PROMPT.format(
        dimension=dimension,
        question_text=question.get("question_text", ""),
        answer_text=answer_text,
    )
    for attempt in range(2):
        try:
            raw = llm_call_fn(prompt)
            parsed = _parse_json(raw)
            score = int(parsed["score"])
            if 0 <= score <= 100:
                return float(score)
        except Exception as exc:
            logger.warning("Free text scoring attempt %d failed: %s", attempt + 1, exc)
    return 50.0
