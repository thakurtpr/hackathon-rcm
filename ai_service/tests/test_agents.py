import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.agents import (
    doc_verification_agent,
    eligibility_eval_agent,
    final_approval_agent,
    orchestrator,
    policy_compliance_agent,
    profile_agent,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_backend() -> AsyncMock:
    mock = AsyncMock()
    mock.post_explanation_result = AsyncMock(return_value=None)
    return mock


def _make_llm(response: str = "Test LLM response.") -> MagicMock:
    return MagicMock(return_value=response)


def _base_state(**overrides) -> dict:
    state = {
        "app_id": "app-001",
        "user_id": "user-001",
        "composite_score": 75.0,
        "band": "approved",
        "profile": {
            "course": "B.Tech",
            "institution": "IIT Delhi",
            "loan_amount": 500000,
            "annual_income": 150000,
        },
        "doc_statuses": {"aadhaar": "verified", "pan": "verified"},
        "fraud_flag": False,
        "pq_score": 70.0,
        "loan_amount": 500000.0,
        "course": "B.Tech",
        "institution": "IIT Delhi",
        "profile_summary": "",
        "doc_verdict": "",
        "eligibility_rationale": "",
        "policy_flags": [],
        "final_decision": "",
        "explanation": "",
        "improvement_hints": [],
        "pq_override": False,
    }
    state.update(overrides)
    return state


# ---------------------------------------------------------------------------
# Test 1: profile_agent updates profile_summary
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_profile_agent_updates_profile_summary():
    state = _base_state()
    llm = _make_llm("This is a 3-sentence profile summary.")

    updated = await profile_agent.run(state, llm)

    assert updated["profile_summary"] == "This is a 3-sentence profile summary."
    llm.assert_called_once()
    assert "profile_summary" in updated


# ---------------------------------------------------------------------------
# Test 2: profile_agent handles LLM error gracefully
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_profile_agent_handles_error():
    state = _base_state()

    def raising_llm(prompt):
        raise RuntimeError("LLM unavailable")

    updated = await profile_agent.run(state, raising_llm)

    assert "Profile summary" in updated["profile_summary"]


# ---------------------------------------------------------------------------
# Test 3: doc_verification_agent updates doc_verdict
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_doc_verification_agent_updates_doc_verdict():
    state = _base_state()
    llm = _make_llm("All documents are verified. No discrepancies found.")

    updated = await doc_verification_agent.run(state, llm)

    assert updated["doc_verdict"] == "All documents are verified. No discrepancies found."
    llm.assert_called_once()


# ---------------------------------------------------------------------------
# Test 4: eligibility_eval_agent updates eligibility_rationale
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_eligibility_eval_agent_updates_rationale():
    state = _base_state()
    llm = _make_llm("Score driven by academic performance. PQ shows strong potential. Band approved.")

    updated = await eligibility_eval_agent.run(state, llm)

    assert updated["eligibility_rationale"] == "Score driven by academic performance. PQ shows strong potential. Band approved."
    llm.assert_called_once()


# ---------------------------------------------------------------------------
# Test 5: policy_compliance_agent updates policy_flags with JSON array
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_policy_compliance_agent_updates_policy_flags():
    state = _base_state()
    llm = _make_llm('["Loan exceeds IBA scheme limit for this course type"]')

    updated = await policy_compliance_agent.run(state, llm)

    assert isinstance(updated["policy_flags"], list)
    assert len(updated["policy_flags"]) == 1
    assert "IBA" in updated["policy_flags"][0]


# ---------------------------------------------------------------------------
# Test 6: policy_compliance_agent returns empty list when compliant
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_policy_compliance_agent_empty_flags():
    state = _base_state()
    llm = _make_llm("[]")

    updated = await policy_compliance_agent.run(state, llm)

    assert updated["policy_flags"] == []


# ---------------------------------------------------------------------------
# Test 7: final_approval_agent updates explanation and improvement_hints
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_final_approval_agent_updates_explanation():
    state = _base_state(
        profile_summary="Good academic background.",
        doc_verdict="Documents verified.",
        eligibility_rationale="Score of 75 qualifies.",
        policy_flags=[],
    )
    llm_response = '{"explanation": "Application approved based on strong profile.", "improvement_hints": ["Maintain CGPA above 7.5"]}'
    llm = _make_llm(llm_response)

    updated = await final_approval_agent.run(state, llm)

    assert updated["explanation"] == "Application approved based on strong profile."
    assert updated["improvement_hints"] == ["Maintain CGPA above 7.5"]
    assert updated["final_decision"] == "approved"


# ---------------------------------------------------------------------------
# Test 8: final_approval_agent caps improvement_hints at 3
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_final_approval_agent_caps_hints_at_three():
    state = _base_state()
    llm_response = '{"explanation": "Approved.", "improvement_hints": ["hint1", "hint2", "hint3", "hint4", "hint5"]}'
    llm = _make_llm(llm_response)

    updated = await final_approval_agent.run(state, llm)

    assert len(updated["improvement_hints"]) <= 3


# ---------------------------------------------------------------------------
# Test 9: LangGraph orchestrator runs all nodes in order (no fraud)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_orchestrator_runs_all_nodes():
    calls = []

    def tracking_llm(prompt: str) -> str:
        calls.append(prompt[:50])
        if "compliance" in prompt.lower() or "RBI" in prompt:
            return "[]"
        if "final" in prompt.lower() or "explanation" in prompt.lower():
            return '{"explanation": "Approved.", "improvement_hints": []}'
        return "Agent response."

    backend = _make_backend()

    result = await orchestrator.run(
        app_id="app-test",
        user_id="user-test",
        composite_score=75.0,
        band="approved",
        pq_score=65.0,
        profile={"course": "MBA", "institution": "IIM", "loan_amount": 1000000},
        doc_statuses={"aadhaar": "verified"},
        fraud_flag=False,
        backend_client=backend,
        llm_call_fn=tracking_llm,
    )

    assert result["final_decision"] == "approved"
    assert result["profile_summary"] != ""
    assert result["doc_verdict"] != ""
    assert result["eligibility_rationale"] != ""
    assert "policy_flags" in result
    assert result["explanation"] != ""
    # post_explanation_result must be called exactly once
    backend.post_explanation_result.assert_called_once()


# ---------------------------------------------------------------------------
# Test 10: Conditional edge skips to final_approval_agent when fraud_flag=True
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_orchestrator_skips_to_final_on_fraud():
    doc_agent_calls = []
    eligibility_calls = []

    def tracking_llm(prompt: str) -> str:
        # Track which agents ran by detecting their unique prompt keywords
        if "document verification officer" in prompt.lower():
            doc_agent_calls.append(prompt)
        if "eligibility analyst" in prompt.lower():
            eligibility_calls.append(prompt)
        if "RBI compliance" in prompt:
            return "[]"
        if "improvement_hints" in prompt:
            return '{"explanation": "Rejected due to fraud.", "improvement_hints": []}'
        return "Fraud detected profile summary."

    backend = _make_backend()

    result = await orchestrator.run(
        app_id="app-fraud",
        user_id="user-fraud",
        composite_score=40.0,
        band="rejected",
        pq_score=30.0,
        profile={"course": "B.Com", "institution": "DU", "loan_amount": 200000},
        doc_statuses={},
        fraud_flag=True,
        backend_client=backend,
        llm_call_fn=tracking_llm,
    )

    # When fraud_flag=True, doc_verification and eligibility should be skipped
    assert len(doc_agent_calls) == 0, "doc_verification_agent should be skipped on fraud"
    assert len(eligibility_calls) == 0, "eligibility_eval_agent should be skipped on fraud"
    assert result["final_decision"] == "rejected"
    backend.post_explanation_result.assert_called_once()


# ---------------------------------------------------------------------------
# Test 11: pq_override is set correctly (50 <= score <= 69 and pq >= 80)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_orchestrator_pq_override_applied():
    def simple_llm(prompt: str) -> str:
        if "RBI compliance" in prompt:
            return "[]"
        if "improvement_hints" in prompt:
            return '{"explanation": "Borderline approved via PQ override.", "improvement_hints": ["Keep up the good work"]}'
        return "Standard response."

    backend = _make_backend()

    result = await orchestrator.run(
        app_id="app-pq",
        user_id="user-pq",
        composite_score=60.0,  # In 50-69 range
        band="review",
        pq_score=85.0,          # pq >= 80 triggers override
        profile={"course": "BCA", "institution": "Amity", "loan_amount": 300000},
        doc_statuses={"aadhaar": "verified"},
        fraud_flag=False,
        backend_client=backend,
        llm_call_fn=simple_llm,
    )

    assert result["pq_override"] is True


# ---------------------------------------------------------------------------
# Test 12: Full pipeline produces expected state shape
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_orchestrator_final_state_shape():
    def llm(prompt: str) -> str:
        if "RBI compliance" in prompt:
            return "[]"
        if "improvement_hints" in prompt:
            return '{"explanation": "Loan approved.", "improvement_hints": ["Tip 1", "Tip 2"]}'
        return "Response."

    backend = _make_backend()

    result = await orchestrator.run(
        app_id="app-shape",
        user_id="user-shape",
        composite_score=80.0,
        band="approved",
        pq_score=72.0,
        profile={"course": "B.Tech", "institution": "VIT", "loan_amount": 700000},
        doc_statuses={"aadhaar": "verified", "pan": "verified"},
        fraud_flag=False,
        backend_client=backend,
        llm_call_fn=llm,
    )

    expected_keys = {
        "app_id", "user_id", "composite_score", "band",
        "profile_summary", "doc_verdict", "eligibility_rationale",
        "policy_flags", "final_decision", "explanation", "improvement_hints",
        "pq_override",
    }
    for key in expected_keys:
        assert key in result, f"Missing key in final state: {key}"

    assert isinstance(result["policy_flags"], list)
    assert isinstance(result["improvement_hints"], list)
    assert result["final_decision"] == "approved"
