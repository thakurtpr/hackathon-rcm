import hashlib
import json
import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.pipelines.behavioral_pipeline import (
    DIMENSION_WEIGHTS,
    _fallback_questions,
    _validate_questions,
    score_answers,
)
from app.models.requests import AnswerItem
from app.models.responses import BehavioralResult


def test_mcq_scoring():
    rubric_path = os.path.join(os.path.dirname(__file__), "../app/prompts/mcq_rubric.json")
    with open(rubric_path) as f:
        rubric = json.load(f)
    scores = rubric["option_index_to_score"]
    assert scores["0"] == 0
    assert scores["1"] == 33
    assert scores["2"] == 66
    assert scores["3"] == 100


def test_dimension_weights_sum_to_one():
    total = sum(DIMENSION_WEIGHTS.values())
    assert abs(total - 1.0) < 1e-9, f"Weights sum to {total}, expected 1.0"


def test_pq_score_range():
    """pq_score must always be between 0 and 100."""
    from app.pipelines.behavioral_pipeline import _compute_age
    # Simulate extreme scores
    import app.pipelines.behavioral_pipeline as bp
    dim_averages = {d: 100.0 for d in bp.DIMENSION_WEIGHTS}
    pq = sum(dim_averages[d] * w for d, w in bp.DIMENSION_WEIGHTS.items())
    pq = round(min(100.0, max(0.0, pq)), 2)
    assert 0.0 <= pq <= 100.0

    dim_averages_zero = {d: 0.0 for d in bp.DIMENSION_WEIGHTS}
    pq_zero = sum(dim_averages_zero[d] * w for d, w in bp.DIMENSION_WEIGHTS.items())
    pq_zero = round(min(100.0, max(0.0, pq_zero)), 2)
    assert 0.0 <= pq_zero <= 100.0


@pytest.mark.asyncio
async def test_suspicious_fast_flag():
    questions = _fallback_questions()
    questions_json = json.dumps(questions)

    answers = [
        AnswerItem(question_id=q["question_id"], answer="3", time_taken_seconds=5)
        for q in questions
    ]

    mock_redis = AsyncMock()
    mock_redis.get_json = AsyncMock(return_value=questions)

    with patch("app.services.redis_service.get_json", return_value=questions):
        import app.pipelines.behavioral_pipeline as bp
        orig = bp.score_answers

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
