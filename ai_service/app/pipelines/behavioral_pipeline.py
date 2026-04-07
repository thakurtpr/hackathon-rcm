import hashlib
import json
import logging
import os
import re
from datetime import date
from typing import Callable

from app.models.requests import AnswerItem
from app.models.responses import BehavioralResult, DimensionScores
from app.prompts.question_generation import QUESTION_GENERATION_PROMPT
from app.prompts.answer_scoring import ANSWER_SCORING_PROMPT

logger = logging.getLogger(__name__)

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
    return json.loads(raw)


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
    return (
        f"Student is studying {profile.get('course', 'Unknown course')} at "
        f"{profile.get('institution', 'Unknown institution')} "
        f"(NIRF rank: {profile.get('nirf_rank', 'unranked')}) in "
        f"{profile.get('state', 'India')}, India. "
        f"Family income: ₹{profile.get('annual_income', 0)}/year. "
        f"Last exam result: {profile.get('percentage', 0)}%. "
        f"Category: {profile.get('category', 'general')}. "
        f"Loan requested: ₹{profile.get('loan_amount', 0)} for "
        f"{profile.get('loan_tenure', 5)} years. "
        f"Gender: {profile.get('gender', 'unknown')}. Age: {age}."
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


async def generate_questions(
    profile: dict,
    app_id: str,
    redis_service,
    llm_call_fn: Callable[[str], str],
) -> list:
    cached = await redis_service.get_json(f"questions:{app_id}")
    if cached:
        return cached

    profile_context = _build_profile_context(profile)
    prompt = QUESTION_GENERATION_PROMPT.format(profile_context=profile_context)

    questions = []
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
                    "Dimensions: financial_responsibility, resilience, goal_clarity, risk_awareness, initiative, social_capital."
                )
        except Exception as exc:
            logger.warning("Question generation attempt %d failed: %s", attempt + 1, exc)
            questions = []

    if not _validate_questions(questions):
        questions = _fallback_questions()

    await redis_service.set_json(f"questions:{app_id}", questions, ttl=3600)
    return questions


def _fallback_questions() -> list:
    return [
        {"question_id": "q1", "question_text": "If you receive your first loan disbursement, what is the first thing you would do with it?", "type": "mcq", "options": ["Buy something I want", "Spend it on daily needs", "Save some and use rest for fees", "Pay tuition first and keep the rest for semester expenses"], "dimension": "financial_responsibility"},
        {"question_id": "q2", "question_text": "You fail one subject in your first semester. How do you respond?", "type": "mcq", "options": ["Give up on the course", "Feel bad and do nothing", "Study harder without a plan", "Seek help from teachers and create a study plan"], "dimension": "resilience"},
        {"question_id": "q3", "question_text": "What do you plan to do with your degree after completing it?", "type": "free_text", "options": None, "dimension": "goal_clarity"},
        {"question_id": "q4", "question_text": "A friend asks to borrow your loan money for a week. What do you do?", "type": "mcq", "options": ["Lend everything", "Lend half", "Decline politely", "Explain loan terms and firmly decline"], "dimension": "financial_responsibility"},
        {"question_id": "q5", "question_text": "You lose your part-time job during your course. How do you handle expenses?", "type": "mcq", "options": ["Drop out", "Ask family to pay everything", "Look for another job casually", "Immediately search for new work and cut non-essential spending"], "dimension": "resilience"},
        {"question_id": "q6", "question_text": "Describe a time when you took initiative to solve a problem on your own without anyone asking.", "type": "free_text", "options": None, "dimension": "initiative"},
        {"question_id": "q7", "question_text": "What is the risk of taking a higher loan amount than you need?", "type": "mcq", "options": ["No risk", "Slightly higher EMI", "More debt burden after graduation", "Higher debt, longer repayment, and less financial freedom after studies"], "dimension": "risk_awareness"},
        {"question_id": "q8", "question_text": "How would you involve your family or community in supporting your education goals?", "type": "free_text", "options": None, "dimension": "social_capital"},
    ]


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
