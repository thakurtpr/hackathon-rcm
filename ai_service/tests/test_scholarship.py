import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.responses import ScholarshipMatch, ScholarshipResult
from app.pipelines import scholarship_pipeline


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_qdrant_result(payload: dict) -> MagicMock:
    point = MagicMock()
    point.payload = payload
    return point


def _make_backend(profile: dict | None = None) -> AsyncMock:
    mock = AsyncMock()
    mock.get_profile = AsyncMock(return_value=profile or _default_profile())
    mock.post_scholarship_result = AsyncMock(return_value=None)
    return mock


def _default_profile() -> dict:
    return {
        "course": "B.Tech",
        "institution": "NIT Rourkela",
        "state": "odisha",
        "category": "sc",
        "annual_income": 180000,
        "percentage": 72.0,
        "gender": "M",
        "loan_type": "education",
        "loan_amount": 500000,
    }


def _sc_scholarship_payload() -> dict:
    return {
        "id": "s001",
        "name": "Post Matric Scholarship for SC Students (NSP)",
        "amount": 50000,
        "category": ["sc"],
        "income_limit": 250000,
        "deadline": "2099-12-31",
        "source": "NSP/Ministry of Social Justice",
        "description": "Central government scholarship for SC students.",
        "gender": "any",
        "state": "all",
        "min_percentage": 50.0,
    }


def _make_qdrant(results: list | None = None) -> AsyncMock:
    mock = AsyncMock()
    mock.search = AsyncMock(return_value=results or [])
    return mock


def _make_embedder(vector: list | None = None) -> MagicMock:
    mock = MagicMock()
    mock.encode = MagicMock(return_value=MagicMock(tolist=MagicMock(return_value=vector or [0.1] * 384)))
    return mock


# ---------------------------------------------------------------------------
# Test 1: match() returns correct scholarships when Qdrant returns matches
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_match_returns_correct_scholarships():
    profile = _default_profile()
    qdrant_results = [_make_qdrant_result(_sc_scholarship_payload())]

    result = await scholarship_pipeline.match(
        user_id="user-001",
        app_id="app-001",
        backend_client=_make_backend(profile),
        qdrant_service=_make_qdrant(qdrant_results),
        embedder=_make_embedder(),
        llm_call_fn=lambda prompt: "This SC student qualifies based on caste and income criteria.",
    )

    assert isinstance(result, ScholarshipResult)
    assert result.app_id == "app-001"
    assert len(result.matched_scholarships) == 1
    assert result.matched_scholarships[0].name == "Post Matric Scholarship for SC Students (NSP)"
    assert result.matched_scholarships[0].amount == 50000


# ---------------------------------------------------------------------------
# Test 2: Groq reason generation is invoked and stored
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_groq_reason_is_included_in_result():
    profile = _default_profile()
    qdrant_results = [_make_qdrant_result(_sc_scholarship_payload())]
    expected_reason = "Student is from SC category with income under 2.5 lakh."

    llm_calls = []

    def mock_llm(prompt: str) -> str:
        llm_calls.append(prompt)
        return expected_reason

    result = await scholarship_pipeline.match(
        user_id="user-002",
        app_id="app-002",
        backend_client=_make_backend(profile),
        qdrant_service=_make_qdrant(qdrant_results),
        embedder=_make_embedder(),
        llm_call_fn=mock_llm,
    )

    assert len(llm_calls) == 1
    assert "Post Matric Scholarship for SC Students (NSP)" in llm_calls[0]
    assert result.matched_scholarships[0].reason == expected_reason


# ---------------------------------------------------------------------------
# Test 3: Income filtering removes scholarships where applicant income exceeds limit
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_income_filtering_removes_ineligible_scholarships():
    # Student has income 400000 but scholarship income_limit is 250000
    high_income_profile = {**_default_profile(), "annual_income": 400000}
    qdrant_results = [_make_qdrant_result(_sc_scholarship_payload())]

    result = await scholarship_pipeline.match(
        user_id="user-003",
        app_id="app-003",
        backend_client=_make_backend(high_income_profile),
        qdrant_service=_make_qdrant(qdrant_results),
        embedder=_make_embedder(),
        llm_call_fn=lambda p: "reason",
    )

    assert len(result.matched_scholarships) == 0
    assert result.total_scholarship_value == 0


# ---------------------------------------------------------------------------
# Test 4: Expired deadline is filtered out
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_expired_deadline_filtered_out():
    expired_payload = {**_sc_scholarship_payload(), "deadline": "2020-01-01"}
    qdrant_results = [_make_qdrant_result(expired_payload)]

    result = await scholarship_pipeline.match(
        user_id="user-004",
        app_id="app-004",
        backend_client=_make_backend(_default_profile()),
        qdrant_service=_make_qdrant(qdrant_results),
        embedder=_make_embedder(),
        llm_call_fn=lambda p: "reason",
    )

    assert len(result.matched_scholarships) == 0


# ---------------------------------------------------------------------------
# Test 5: Category filtering removes mismatched category
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_category_filtering_removes_wrong_category():
    # Student is OBC but scholarship is SC-only
    obc_profile = {**_default_profile(), "category": "obc"}
    qdrant_results = [_make_qdrant_result(_sc_scholarship_payload())]

    result = await scholarship_pipeline.match(
        user_id="user-005",
        app_id="app-005",
        backend_client=_make_backend(obc_profile),
        qdrant_service=_make_qdrant(qdrant_results),
        embedder=_make_embedder(),
        llm_call_fn=lambda p: "reason",
    )

    assert len(result.matched_scholarships) == 0


# ---------------------------------------------------------------------------
# Test 6: total_scholarship_value is sum of all matched amounts
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_total_scholarship_value_is_correct():
    profile = _default_profile()
    payload1 = _sc_scholarship_payload()
    payload2 = {**_sc_scholarship_payload(), "name": "Another SC Scheme", "amount": 30000}
    qdrant_results = [
        _make_qdrant_result(payload1),
        _make_qdrant_result(payload2),
    ]

    result = await scholarship_pipeline.match(
        user_id="user-006",
        app_id="app-006",
        backend_client=_make_backend(profile),
        qdrant_service=_make_qdrant(qdrant_results),
        embedder=_make_embedder(),
        llm_call_fn=lambda p: "Eligible.",
    )

    assert len(result.matched_scholarships) == 2
    assert result.total_scholarship_value == 80000


# ---------------------------------------------------------------------------
# Test 7: Returns empty result when profile is None
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_result_when_no_profile():
    backend = AsyncMock()
    backend.get_profile = AsyncMock(return_value=None)

    result = await scholarship_pipeline.match(
        user_id="user-007",
        app_id="app-007",
        backend_client=backend,
        qdrant_service=_make_qdrant(),
        embedder=_make_embedder(),
        llm_call_fn=lambda p: "reason",
    )

    assert result.app_id == "app-007"
    assert result.matched_scholarships == []
    assert result.total_scholarship_value == 0


# ---------------------------------------------------------------------------
# Test 8: LLM failure falls back to default reason
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_llm_failure_uses_fallback_reason():
    qdrant_results = [_make_qdrant_result(_sc_scholarship_payload())]

    def failing_llm(prompt: str) -> str:
        raise RuntimeError("Groq unavailable")

    result = await scholarship_pipeline.match(
        user_id="user-008",
        app_id="app-008",
        backend_client=_make_backend(_default_profile()),
        qdrant_service=_make_qdrant(qdrant_results),
        embedder=_make_embedder(),
        llm_call_fn=failing_llm,
    )

    assert len(result.matched_scholarships) == 1
    assert "Post Matric Scholarship for SC Students (NSP)" in result.matched_scholarships[0].reason


# ---------------------------------------------------------------------------
# Test 9: scholarships.json has exactly 20 entries
# ---------------------------------------------------------------------------

def test_scholarships_json_has_20_entries():
    import json
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "scholarships.json")
    with open(data_path) as f:
        data = json.load(f)
    assert len(data) == 20, f"Expected 20 scholarships, got {len(data)}"


# ---------------------------------------------------------------------------
# Test 10: All scholarships have required fields
# ---------------------------------------------------------------------------

def test_scholarships_have_required_fields():
    import json
    required_fields = {"id", "name", "amount", "category", "income_limit", "deadline", "description", "eligibility_criteria"}
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "scholarships.json")
    with open(data_path) as f:
        data = json.load(f)
    for entry in data:
        missing = required_fields - set(entry.keys())
        assert not missing, f"Scholarship {entry.get('id')} missing fields: {missing}"
