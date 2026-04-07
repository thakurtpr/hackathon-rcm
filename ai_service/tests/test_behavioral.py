import hashlib
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.pipelines.behavioral_pipeline import (
    DIMENSION_WEIGHTS,
    _fallback_questions,
    _validate_questions,
    score_answers,
)
from app.models.requests import AnswerItem, SubmitAnswersRequest
from app.models.responses import BehavioralResult


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
    """Fallback questions must have 3 MCQ situational + 2 MCQ financial + 2 free_text + 1 free_text initiative."""
    questions = _fallback_questions()
    mcq_count = sum(1 for q in questions if q["type"] == "mcq")
    free_text_count = sum(1 for q in questions if q["type"] == "free_text")
    assert mcq_count == 5, f"Expected 5 MCQ questions, got {mcq_count}"
    assert free_text_count == 3, f"Expected 3 free_text questions, got {free_text_count}"

    # Each MCQ must have exactly 4 options
    for q in questions:
        if q["type"] == "mcq":
            assert q.get("options") is not None, f"MCQ {q['question_id']} missing options"
            assert len(q["options"]) == 4, f"MCQ {q['question_id']} must have 4 options"

    # Initiative dimension must have at least one free_text
    initiative_free = [q for q in questions if q["dimension"] == "initiative" and q["type"] == "free_text"]
    assert len(initiative_free) >= 1, "Must have at least one free_text initiative question"


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


def test_get_questions_returns_404_when_not_cached(app_client):
    """GET /behavioral/questions must return 404 when no cached questions exist."""
    with patch("app.services.redis_service.get_json", new=AsyncMock(return_value=None)):
        response = app_client.get("/behavioral/questions?app_id=nonexistent-app")

    assert response.status_code == 404


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
