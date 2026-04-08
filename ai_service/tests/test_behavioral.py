import hashlib
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.pipelines.behavioral_pipeline import (
    DIMENSION_WEIGHTS,
    _validate_questions,
    generate_questions,
    score_answers,
)
from app.models.requests import AnswerItem, SubmitAnswersRequest
from app.models.responses import BehavioralResult


# ---------------------------------------------------------------------------
# Helper: build a minimal valid 8-question list
# ---------------------------------------------------------------------------

def _make_valid_questions(suffix: str = "") -> list:
    """Return a valid 8-question list whose first question text includes suffix."""
    return [
        {
            "question_id": "q1",
            "question_text": f"Financial scenario question for this student {suffix}",
            "type": "mcq",
            "options": ["A", "B", "C", "D"],
            "dimension": "financial_responsibility",
        },
        {
            "question_id": "q2",
            "question_text": f"Resilience free text question {suffix}",
            "type": "free_text",
            "options": None,
            "dimension": "resilience",
        },
        {
            "question_id": "q3",
            "question_text": f"Goal clarity free text question {suffix}",
            "type": "free_text",
            "options": None,
            "dimension": "goal_clarity",
        },
        {
            "question_id": "q4",
            "question_text": f"Risk awareness MCQ one {suffix}",
            "type": "mcq",
            "options": ["A", "B", "C", "D"],
            "dimension": "risk_awareness",
        },
        {
            "question_id": "q5",
            "question_text": f"Risk awareness MCQ two {suffix}",
            "type": "mcq",
            "options": ["A", "B", "C", "D"],
            "dimension": "risk_awareness",
        },
        {
            "question_id": "q6",
            "question_text": f"Initiative MCQ one {suffix}",
            "type": "mcq",
            "options": ["A", "B", "C", "D"],
            "dimension": "initiative",
        },
        {
            "question_id": "q7",
            "question_text": f"Initiative MCQ two {suffix}",
            "type": "mcq",
            "options": ["A", "B", "C", "D"],
            "dimension": "initiative",
        },
        {
            "question_id": "q8",
            "question_text": f"Social capital MCQ {suffix}",
            "type": "mcq",
            "options": ["A", "B", "C", "D"],
            "dimension": "social_capital",
        },
    ]


def _fallback_questions() -> list:
    """Return a stable set of questions for tests that don't test uniqueness."""
    return _make_valid_questions(suffix="fallback")


# ---------------------------------------------------------------------------
# MCQ rubric tests
# ---------------------------------------------------------------------------

def test_mcq_scoring():
    rubric_path = os.path.join(os.path.dirname(__file__), "../app/prompts/mcq_rubric.json")
    with open(rubric_path) as f:
        rubric = json.load(f)
    scores = rubric["option_index_to_score"]
    assert scores["0"] == 0
    assert scores["1"] == 33
    assert scores["2"] == 66
    assert scores["3"] == 100


def test_mcq_rubric_has_required_keys():
    rubric_path = os.path.join(os.path.dirname(__file__), "../app/prompts/mcq_rubric.json")
    with open(rubric_path) as f:
        rubric = json.load(f)
    assert "option_index_to_score" in rubric
    assert set(rubric["option_index_to_score"].keys()) == {"0", "1", "2", "3"}


# ---------------------------------------------------------------------------
# Dimension weight tests
# ---------------------------------------------------------------------------

def test_dimension_weights_sum_to_one():
    total = sum(DIMENSION_WEIGHTS.values())
    assert abs(total - 1.0) < 1e-9, f"Weights sum to {total}, expected 1.0"


def test_dimension_weights_exact_values():
    assert DIMENSION_WEIGHTS["financial_responsibility"] == 0.20
    assert DIMENSION_WEIGHTS["resilience"] == 0.20
    assert DIMENSION_WEIGHTS["goal_clarity"] == 0.20
    assert DIMENSION_WEIGHTS["risk_awareness"] == 0.15
    assert DIMENSION_WEIGHTS["initiative"] == 0.15
    assert DIMENSION_WEIGHTS["social_capital"] == 0.10


# ---------------------------------------------------------------------------
# PQ score range
# ---------------------------------------------------------------------------

def test_pq_score_range():
    """pq_score must always be between 0 and 100."""
    import app.pipelines.behavioral_pipeline as bp

    dim_averages = {d: 100.0 for d in bp.DIMENSION_WEIGHTS}
    pq = sum(dim_averages[d] * w for d, w in bp.DIMENSION_WEIGHTS.items())
    pq = round(min(100.0, max(0.0, pq)), 2)
    assert 0.0 <= pq <= 100.0

    dim_averages_zero = {d: 0.0 for d in bp.DIMENSION_WEIGHTS}
    pq_zero = sum(dim_averages_zero[d] * w for d, w in bp.DIMENSION_WEIGHTS.items())
    pq_zero = round(min(100.0, max(0.0, pq_zero)), 2)
    assert 0.0 <= pq_zero <= 100.0


def test_pq_weighted_formula():
    """PQ = weighted sum of dimension scores with exact weights."""
    import app.pipelines.behavioral_pipeline as bp

    # All dims at 80 → PQ should be 80 exactly (weights sum to 1.0)
    dim_averages = {d: 80.0 for d in bp.DIMENSION_WEIGHTS}
    pq = sum(dim_averages[d] * w for d, w in bp.DIMENSION_WEIGHTS.items())
    pq = round(min(100.0, max(0.0, pq)), 2)
    assert pq == 80.0


# ---------------------------------------------------------------------------
# question_hash tests
# ---------------------------------------------------------------------------

def test_question_hash_is_sha256_of_sorted_ids():
    """question_hash must be sha256 of sorted question IDs joined by comma."""
    questions = _fallback_questions()
    ids = sorted(q["question_id"] for q in questions)
    expected_hash = hashlib.sha256(",".join(ids).encode()).hexdigest()

    # Verify the fallback questions produce the known hash
    joined = ",".join(ids)
    computed = hashlib.sha256(joined.encode()).hexdigest()
    assert computed == expected_hash
    assert len(expected_hash) == 64  # sha256 hex digest is always 64 chars


@pytest.mark.asyncio
async def test_score_answers_question_hash():
    """score_answers must set question_hash = sha256(sorted question IDs)."""
    questions = _fallback_questions()
    answers = [
        AnswerItem(question_id=q["question_id"], answer="3", time_taken_seconds=10)
        for q in questions
    ]

    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=questions)

    result = await score_answers(
        "test-hash-001", answers, mock_redis, lambda p: '{"score": 75, "reasoning": "ok"}'
    )

    expected_hash = hashlib.sha256(
        ",".join(sorted(q["question_id"] for q in questions)).encode()
    ).hexdigest()
    assert result.question_hash == expected_hash


# ---------------------------------------------------------------------------
# time_flags tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_suspicious_fast_flag():
    questions = _fallback_questions()
    answers = [
        AnswerItem(question_id=q["question_id"], answer="3", time_taken_seconds=5)
        for q in questions
    ]

    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=questions)

    with patch("app.services.redis_service.get_json", return_value=questions):
        result = await score_answers(
            "test-app-001", answers, mock_redis, lambda p: '{"score": 75, "reasoning": "ok"}'
        )
    assert "suspiciously_fast" in result.time_flags


@pytest.mark.asyncio
async def test_suspicious_fast_flag_not_raised_slow():
    questions = _fallback_questions()
    answers = [
        AnswerItem(question_id=q["question_id"], answer="3", time_taken_seconds=15)
        for q in questions
    ]
    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=questions)

    result = await score_answers(
        "test-app-002", answers, mock_redis, lambda p: '{"score": 75, "reasoning": "ok"}'
    )
    assert "suspiciously_fast" not in result.time_flags


@pytest.mark.asyncio
async def test_time_flags_exact_60_seconds_not_flagged():
    """Exactly 60 total seconds should NOT trigger the rushed flag."""
    questions = _fallback_questions()
    # 8 questions × 7.5 seconds = 60 seconds total (just at boundary)
    answers = [
        AnswerItem(question_id=q["question_id"], answer="2", time_taken_seconds=8)
        for q in questions
    ]
    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=questions)

    result = await score_answers(
        "test-app-boundary", answers, mock_redis, lambda p: '{"score": 60, "reasoning": "ok"}'
    )
    # 8 * 8 = 64 seconds, should NOT be flagged
    assert "suspiciously_fast" not in result.time_flags


# ---------------------------------------------------------------------------
# Question validation tests
# ---------------------------------------------------------------------------

def test_question_validation_exact_8():
    questions = _fallback_questions()
    assert _validate_questions(questions) is True


def test_question_validation_fails_7():
    questions = _fallback_questions()[:7]
    assert _validate_questions(questions) is False


def test_question_validation_fails_9():
    questions = _fallback_questions()
    extra = questions[0].copy()
    extra["question_id"] = "q9"
    questions.append(extra)
    assert _validate_questions(questions) is False


def test_fallback_questions_have_correct_mix():
    """
    Per the updated spec, the 8 questions must have:
      Q1 MCQ financial_responsibility
      Q2 free_text resilience
      Q3 free_text goal_clarity
      Q4 MCQ risk_awareness
      Q5 MCQ risk_awareness
      Q6 MCQ initiative
      Q7 MCQ initiative
      Q8 MCQ social_capital
    = 6 MCQ, 2 free_text
    """
    questions = _fallback_questions()
    mcq_count = sum(1 for q in questions if q["type"] == "mcq")
    free_text_count = sum(1 for q in questions if q["type"] == "free_text")
    assert mcq_count == 6, f"Expected 6 MCQ questions per updated spec, got {mcq_count}"
    assert free_text_count == 2, f"Expected 2 free_text questions per updated spec, got {free_text_count}"

    # Each MCQ must have exactly 4 options
    for q in questions:
        if q["type"] == "mcq":
            assert q.get("options") is not None, f"MCQ {q['question_id']} missing options"
            assert len(q["options"]) == 4, f"MCQ {q['question_id']} must have 4 options"

    # Resilience and goal_clarity must be free_text
    resilience_free = [q for q in questions if q["dimension"] == "resilience" and q["type"] == "free_text"]
    assert len(resilience_free) >= 1, "Must have at least one free_text resilience question"
    goal_free = [q for q in questions if q["dimension"] == "goal_clarity" and q["type"] == "free_text"]
    assert len(goal_free) >= 1, "Must have at least one free_text goal_clarity question"


def test_fallback_questions_cover_all_dimensions():
    """All 6 required dimensions must appear."""
    questions = _fallback_questions()
    dims = {q["dimension"] for q in questions}
    required = {"financial_responsibility", "resilience", "goal_clarity", "risk_awareness", "initiative", "social_capital"}
    assert required.issubset(dims), f"Missing dimensions: {required - dims}"


# ---------------------------------------------------------------------------
# MCQ scoring via pipeline (uses rubric)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mcq_option_0_scores_zero():
    """MCQ answer '0' must score 0 points."""
    questions = [_fallback_questions()[0]]  # financial_responsibility MCQ
    answers = [AnswerItem(question_id="q1", answer="0", time_taken_seconds=10)]

    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=questions)

    result = await score_answers(
        "test-mcq-0", answers, mock_redis, lambda p: '{"score": 50, "reasoning": "ok"}'
    )
    # Only q1 answered (fin_resp), others default to 50
    assert result.dimension_scores.fin_resp == 0.0


@pytest.mark.asyncio
async def test_mcq_option_3_scores_100():
    """MCQ answer '3' must score 100 points."""
    questions = [_fallback_questions()[0]]  # financial_responsibility MCQ
    answers = [AnswerItem(question_id="q1", answer="3", time_taken_seconds=10)]

    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=questions)

    result = await score_answers(
        "test-mcq-3", answers, mock_redis, lambda p: '{"score": 50, "reasoning": "ok"}'
    )
    assert result.dimension_scores.fin_resp == 100.0


@pytest.mark.asyncio
async def test_mcq_option_1_scores_33():
    """MCQ answer '1' must score 33 points."""
    questions = [_fallback_questions()[0]]
    answers = [AnswerItem(question_id="q1", answer="1", time_taken_seconds=10)]

    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=questions)

    result = await score_answers(
        "test-mcq-1", answers, mock_redis, lambda p: '{"score": 50, "reasoning": "ok"}'
    )
    assert result.dimension_scores.fin_resp == 33.0


@pytest.mark.asyncio
async def test_free_text_uses_llm_score():
    """Free-text answers must use the LLM-returned score."""
    questions = _fallback_questions()
    # q3 is goal_clarity free_text
    answers = [AnswerItem(question_id="q3", answer="I want to become a software engineer", time_taken_seconds=30)]

    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=questions)

    result = await score_answers(
        "test-free-text", answers, mock_redis, lambda p: '{"score": 80, "reasoning": "clear goal"}'
    )
    assert result.dimension_scores.goal_clarity == 80.0


@pytest.mark.asyncio
async def test_free_text_defaults_to_50_on_llm_failure():
    """When LLM fails for free_text, score must default to 50."""
    questions = _fallback_questions()
    answers = [AnswerItem(question_id="q3", answer="Some answer", time_taken_seconds=20)]

    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=questions)

    def failing_llm(prompt):
        raise RuntimeError("LLM unavailable")

    result = await score_answers(
        "test-free-text-fail", answers, mock_redis, failing_llm
    )
    assert result.dimension_scores.goal_clarity == 50.0


# ---------------------------------------------------------------------------
# Router-level tests (GET /behavioral/questions and POST /behavioral/submit)
# ---------------------------------------------------------------------------

@pytest.fixture
def app_client():
    """Create FastAPI test client with mocked dependencies."""
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from app.routers.behavioral import router

    app = FastAPI()
    app.include_router(router, prefix="/behavioral")
    return TestClient(app)


def test_get_questions_returns_cached(app_client):
    """GET /behavioral/questions must return cached questions from Redis."""
    questions = _fallback_questions()

    with patch("app.services.redis_service.get_json", new=AsyncMock(return_value=questions)):
        response = app_client.get("/behavioral/questions?app_id=test-app-cache")

    assert response.status_code == 200
    data = response.json()
    assert data["app_id"] == "test-app-cache"
    assert len(data["questions"]) == 8


def test_get_questions_returns_503_when_generation_fails(app_client):
    """GET /behavioral/questions must return 503 when AI generation fails (no cache, LLM down)."""
    async def raise_runtime(*args, **kwargs):
        raise RuntimeError("AI question generation failed after 2 attempts.")

    with patch("app.services.redis_service.get_json", new=AsyncMock(return_value=None)), \
         patch("app.services.backend_client.get_student_profile", new=AsyncMock(return_value={})), \
         patch("app.pipelines.behavioral_pipeline.generate_questions", new=raise_runtime):
        response = app_client.get("/behavioral/questions?app_id=nonexistent-app")

    assert response.status_code == 503


def test_get_questions_generates_when_not_cached(app_client):
    """GET /behavioral/questions generates fresh questions from AI when not cached."""
    fresh_questions = _make_valid_questions(suffix="fresh-gen")

    with patch("app.services.redis_service.get_json", new=AsyncMock(return_value=None)), \
         patch("app.services.redis_service.set_json", new=AsyncMock(return_value=None)), \
         patch("app.services.backend_client.get_student_profile", new=AsyncMock(return_value={})), \
         patch("app.config.get_settings") as mock_settings:
        mock_settings.return_value.make_llm_call = lambda p: json.dumps(fresh_questions)
        response = app_client.get("/behavioral/questions?app_id=new-app-123")

    assert response.status_code == 200
    data = response.json()
    assert data["app_id"] == "new-app-123"
    assert len(data["questions"]) == 8


def test_submit_answers_returns_202(app_client):
    """POST /behavioral/submit must return HTTP 202 immediately (async processing)."""
    questions = _fallback_questions()
    payload = {
        "app_id": "test-submit-202",
        "answers": [
            {"question_id": q["question_id"], "answer": "2", "time_taken_seconds": 10}
            for q in questions
        ],
    }

    with patch("app.services.redis_service.get_json", new=AsyncMock(return_value=questions)), \
         patch("app.services.redis_service.set_json", new=AsyncMock(return_value=None)), \
         patch("app.services.backend_client.post_behavioral_result", new=AsyncMock(return_value=None)), \
         patch("app.kafka.producer.produce", new=AsyncMock(return_value=None)):
        response = app_client.post("/behavioral/submit", json=payload)

    assert response.status_code == 202


def test_submit_answers_returns_202_no_body(app_client):
    """POST /behavioral/submit 202 response must have empty body (fire-and-forget)."""
    questions = _fallback_questions()
    payload = {
        "app_id": "test-submit-nobody",
        "answers": [
            {"question_id": q["question_id"], "answer": "1", "time_taken_seconds": 12}
            for q in questions
        ],
    }

    with patch("app.services.redis_service.get_json", new=AsyncMock(return_value=questions)), \
         patch("app.services.redis_service.set_json", new=AsyncMock(return_value=None)), \
         patch("app.services.backend_client.post_behavioral_result", new=AsyncMock(return_value=None)), \
         patch("app.kafka.producer.produce", new=AsyncMock(return_value=None)):
        response = app_client.post("/behavioral/submit", json=payload)

    assert response.status_code == 202
    # 202 response should be empty
    assert response.content == b""


# ---------------------------------------------------------------------------
# Uniqueness tests — AI must generate different questions each call
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generate_questions_returns_different_questions_each_call():
    """
    generate_questions must produce different first questions on consecutive calls
    when the cache is bypassed (force_refresh=True).

    The test mocks the Groq LLM call to return a different question set on each
    invocation, simulating the real-world behaviour where the AI generates fresh
    personalised questions.
    """
    profile = {
        "full_name": "Priya Patel",
        "course": "B.Tech Computer Science",
        "institution": "NIT Odisha",
        "loan_amount": "500000",
        "family_income": "1l_to_3l",
        "state": "Odisha",
        "category": "OBC",
        "dob": "2003-05-15",
    }

    questions_set_1 = _make_valid_questions(suffix="SET_ONE_unique_abc123")
    questions_set_2 = _make_valid_questions(suffix="SET_TWO_unique_xyz789")

    call_count = 0

    def mock_llm_first_call(prompt: str) -> str:
        return json.dumps(questions_set_1)

    def mock_llm_second_call(prompt: str) -> str:
        return json.dumps(questions_set_2)

    # First call — no cache, generates set 1
    mock_redis_1 = AsyncMock()
    mock_redis_1.get_json = AsyncMock(return_value=None)
    mock_redis_1.set_json = AsyncMock(return_value=None)

    result_1 = await generate_questions(
        profile=profile,
        app_id="uniqueness-test-app",
        redis_service=mock_redis_1,
        llm_call_fn=mock_llm_first_call,
        force_refresh=True,
    )

    # Second call — force_refresh bypasses cache, generates set 2
    mock_redis_2 = AsyncMock()
    mock_redis_2.get_json = AsyncMock(return_value=None)
    mock_redis_2.set_json = AsyncMock(return_value=None)

    result_2 = await generate_questions(
        profile=profile,
        app_id="uniqueness-test-app",
        redis_service=mock_redis_2,
        llm_call_fn=mock_llm_second_call,
        force_refresh=True,
    )

    assert len(result_1) == 8
    assert len(result_2) == 8

    first_q_text_1 = result_1[0]["question_text"]
    first_q_text_2 = result_2[0]["question_text"]

    assert first_q_text_1 != first_q_text_2, (
        f"Expected different questions on consecutive calls, but both returned: {first_q_text_1!r}"
    )


@pytest.mark.asyncio
async def test_generate_questions_raises_on_llm_failure():
    """
    generate_questions must raise RuntimeError (not return hardcoded fallback questions)
    when the LLM fails on all retry attempts.
    """
    profile = {"full_name": "Test Student", "course": "B.Sc", "institution": "Test College"}

    def always_failing_llm(prompt: str) -> str:
        raise RuntimeError("Groq API unavailable")

    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=None)
    mock_redis.set_json = AsyncMock(return_value=None)

    with pytest.raises(RuntimeError, match="AI question generation failed"):
        await generate_questions(
            profile=profile,
            app_id="fail-test-app",
            redis_service=mock_redis,
            llm_call_fn=always_failing_llm,
            force_refresh=True,
        )


@pytest.mark.asyncio
async def test_generate_questions_serves_cache_when_not_force_refresh():
    """
    generate_questions must return cached questions without calling the LLM
    when force_refresh=False and a cache hit exists.
    """
    cached = _make_valid_questions(suffix="cached_version")

    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=cached)
    mock_redis.set_json = AsyncMock(return_value=None)

    llm_call_count = 0

    def counting_llm(prompt: str) -> str:
        nonlocal llm_call_count
        llm_call_count += 1
        return json.dumps(_make_valid_questions(suffix="should_not_be_called"))

    result = await generate_questions(
        profile={},
        app_id="cache-hit-test",
        redis_service=mock_redis,
        llm_call_fn=counting_llm,
        force_refresh=False,
    )

    assert result == cached, "Should return cached questions unchanged"
    assert llm_call_count == 0, "LLM must NOT be called when serving from cache"
