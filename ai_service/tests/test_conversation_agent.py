"""Tests for the stateful conversation agent (Disha).

Covers:
- Stage transitions INTENT → PROFILE_COLLECTION
- All 12 profile fields collected in order
- Validation: mobile number, PAN format
- MCQ display with numbered options
- Free-text minimum word count check
- Full 8-question behavioral flow with submit
- Redis stage stored correctly after each turn
- Language detection (English, Hindi, Odia)
- POST_APPROVAL RAG response
"""
import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.agents.conversation_agent import (
    STAGE_AWAITING,
    STAGE_BEHAVIORAL,
    STAGE_INTENT,
    STAGE_KYC,
    STAGE_POST,
    STAGE_PROFILE,
    STAGE_RESULT,
    detect_language,
    validate_mobile,
    validate_pan,
    normalize_income,
    normalize_category,
    normalize_year,
    _validate_field,
    _format_question,
    handle_intent,
    handle_profile_collection,
    handle_kyc_guidance,
    handle_behavioral_assessment,
    handle_post_approval,
    process_message,
)


# ─── Helpers ────────────────────────────────────────────────────────────────

def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _make_redis_mock(stage=None, conv_data=None, questions=None):
    """Return a mock redis module for patching app.agents.conversation_agent._redis."""
    mock = MagicMock()
    mock.get_str = AsyncMock(return_value=stage)
    mock.set_str = AsyncMock(return_value=None)
    mock.get_json = AsyncMock(
        side_effect=lambda key: asyncio.coroutine(lambda: (
            questions if key.startswith("questions:") else conv_data or {}
        ))()
    )
    mock.set_json = AsyncMock(return_value=None)
    return mock


def _async_return(value):
    async def _inner(*args, **kwargs):
        return value
    return _inner


# ─── 1. Language detection ───────────────────────────────────────────────────

def test_detect_language_english():
    assert detect_language("Hello I want a loan") == "en"


def test_detect_language_hindi():
    assert detect_language("मुझे एजुकेशन लोन चाहिए") == "hi"


def test_detect_language_odia():
    assert detect_language("ମୋତେ ଶିକ୍ଷା ଋଣ ଦରକାର") == "od"


def test_detect_language_mixed_prefers_hindi():
    # Hindi chars present → should detect hi
    assert detect_language("I need शिक्षा loan") == "hi"


# ─── 2. Field validators ─────────────────────────────────────────────────────

def test_validate_mobile_valid():
    assert validate_mobile("9876543210") == "9876543210"
    assert validate_mobile("6012345678") == "6012345678"


def test_validate_mobile_invalid_prefix():
    assert validate_mobile("5876543210") is None  # starts with 5


def test_validate_mobile_too_short():
    assert validate_mobile("987654321") is None  # 9 digits


def test_validate_mobile_with_spaces():
    assert validate_mobile("98765 43210") == "9876543210"


def test_validate_pan_valid():
    assert validate_pan("ABCDE1234F") == "ABCDE1234F"
    assert validate_pan("abcde1234f") == "ABCDE1234F"  # lowercased → uppercased


def test_validate_pan_invalid_format():
    assert validate_pan("ABC1234F") is None
    assert validate_pan("12345ABCDF") is None
    assert validate_pan("ABCDE12345") is None  # last char must be letter


def test_validate_field_mobile_valid():
    result, err = _validate_field("mobile", "9876543210", "en")
    assert result == "9876543210"
    assert err == ""


def test_validate_field_mobile_invalid():
    result, err = _validate_field("mobile", "1234567890", "en")
    assert result is None
    assert "10-digit" in err or "6, 7, 8, or 9" in err


def test_validate_field_pan_valid():
    result, err = _validate_field("pan", "ABCDE1234F", "en")
    assert result == "ABCDE1234F"
    assert err == ""


def test_validate_field_pan_invalid():
    result, err = _validate_field("pan", "INVALID", "en")
    assert result is None
    assert "PAN" in err or "format" in err.lower()


def test_validate_field_dob_valid():
    result, err = _validate_field("dob", "15/08/2003", "en")
    assert result == "15/08/2003"


def test_validate_field_dob_too_young():
    result, err = _validate_field("dob", "01/01/2015", "en")
    assert result is None
    assert "16" in err


def test_validate_field_aadhaar_valid():
    result, err = _validate_field("aadhaar", "123456789012", "en")
    assert result == "123456789012"


def test_validate_field_aadhaar_invalid():
    result, err = _validate_field("aadhaar", "12345", "en")
    assert result is None


def test_normalize_income():
    assert normalize_income("1") == "under_1l"
    assert normalize_income("under 1 lakh") == "under_1l"
    assert normalize_income("3") == "3l_to_6l"
    assert normalize_income("above 10 lakh") == "above_10l"
    assert normalize_income("random") is None


def test_normalize_category():
    assert normalize_category("1") == "general"
    assert normalize_category("sc") == "sc"
    assert normalize_category("OBC") == "obc"
    assert normalize_category("3") == "sc"
    assert normalize_category("EWS") == "ews"


def test_normalize_year():
    assert normalize_year("1") == "1st"
    assert normalize_year("3rd") == "3rd"
    assert normalize_year("fifth") == "5th"
    assert normalize_year("6") is None


# ─── 3. MCQ question formatting ──────────────────────────────────────────────

def test_format_mcq_question_has_numbered_options():
    q = {
        "question_id": "q1",
        "question_text": "What would you do with a financial windfall?",
        "type": "mcq",
        "options": ["Spend it all", "Save half", "Invest wisely", "Pay off debts first"],
        "dimension": "financial_responsibility",
    }
    formatted = _format_question(q, 1, 8, "en")
    assert "1." in formatted
    assert "2." in formatted
    assert "3." in formatted
    assert "4." in formatted
    assert "Spend it all" in formatted
    assert "Question 1 of 8" in formatted
    assert "1, 2, 3, or 4" in formatted


def test_format_free_text_question_no_options():
    q = {
        "question_id": "q3",
        "question_text": "Describe your career goals.",
        "type": "free_text",
        "options": None,
        "dimension": "goal_clarity",
    }
    formatted = _format_question(q, 3, 8, "en")
    assert "Describe your career goals." in formatted
    assert "1." not in formatted
    assert "1, 2, 3, or 4" not in formatted


# ─── 4. Stage: INTENT handler ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_intent_first_message_returns_welcome_stays_in_intent():
    conv_data = {}
    reply, new_stage = await handle_intent("hello", "conv-1", conv_data)
    assert new_stage is None  # stay in INTENT
    assert "loan" in reply.lower() or "scholarship" in reply.lower()
    assert conv_data.get("intent_question_asked") is True
    assert conv_data.get("language") == "en"


@pytest.mark.asyncio
async def test_intent_sets_loan_intent():
    conv_data = {"intent_question_asked": True, "language": "en"}
    reply, new_stage = await handle_intent("I want a student loan", "conv-2", conv_data)
    assert conv_data.get("intent") == "loan"
    assert new_stage == STAGE_PROFILE
    assert "full name" in reply.lower() or "name" in reply.lower()


@pytest.mark.asyncio
async def test_intent_sets_scholarship_intent():
    conv_data = {"intent_question_asked": True, "language": "en"}
    reply, new_stage = await handle_intent("I am looking for a scholarship", "conv-3", conv_data)
    assert conv_data.get("intent") == "scholarship"
    assert new_stage == STAGE_PROFILE


@pytest.mark.asyncio
async def test_intent_sets_both_intent():
    conv_data = {"intent_question_asked": True, "language": "en"}
    reply, new_stage = await handle_intent("I want both loan and scholarship", "conv-4", conv_data)
    assert conv_data.get("intent") == "both"
    assert new_stage == STAGE_PROFILE


@pytest.mark.asyncio
async def test_intent_hindi_language_detected():
    conv_data = {}
    reply, _ = await handle_intent("मुझे लोन चाहिए", "conv-5", conv_data)
    assert conv_data.get("language") == "hi"
    assert "नमस्ते" in reply or "स्वागत" in reply


@pytest.mark.asyncio
async def test_intent_odia_language_detected():
    conv_data = {}
    reply, _ = await handle_intent("ମୋତେ ଋଣ ଦରକାର", "conv-6", conv_data)
    assert conv_data.get("language") == "od"
    assert "ନମସ୍କାର" in reply or "ଆପଣ" in reply


# ─── 5. Stage: PROFILE_COLLECTION fields in order ────────────────────────────

@pytest.mark.asyncio
async def test_profile_collection_full_name_first():
    conv_data = {"intent": "loan", "language": "en"}
    reply, new_stage = await handle_profile_collection("Rajan Kumar", "conv-7", conv_data)
    assert conv_data["profile_fields"]["full_name"] == "Rajan Kumar"
    assert conv_data.get("awaiting_field") == "mobile"
    assert "mobile" in reply.lower() or "number" in reply.lower()
    assert new_stage is None


@pytest.mark.asyncio
async def test_profile_collection_mobile_validation_invalid():
    conv_data = {
        "intent": "loan",
        "language": "en",
        "profile_fields": {"full_name": "Rajan"},
        "awaiting_field": "mobile",
    }
    reply, new_stage = await handle_profile_collection("1234567890", "conv-8", conv_data)
    # Invalid mobile — should stay on mobile
    assert conv_data.get("awaiting_field") == "mobile"
    assert "profile_fields" not in conv_data or "mobile" not in conv_data.get("profile_fields", {})
    assert new_stage is None


@pytest.mark.asyncio
async def test_profile_collection_mobile_validation_valid():
    conv_data = {
        "intent": "loan",
        "language": "en",
        "profile_fields": {"full_name": "Rajan"},
        "awaiting_field": "mobile",
    }
    reply, new_stage = await handle_profile_collection("9876543210", "conv-9", conv_data)
    assert conv_data["profile_fields"]["mobile"] == "9876543210"
    assert conv_data.get("awaiting_field") == "dob"


@pytest.mark.asyncio
async def test_profile_collection_pan_validation_invalid():
    conv_data = {
        "intent": "loan",
        "language": "en",
        "profile_fields": {
            "full_name": "Rajan", "mobile": "9876543210", "dob": "01/01/2000",
            "course": "B.Com", "institution": "Ravenshaw", "current_year": "2nd",
            "last_percentage": "60.0", "family_income": "1l_to_3l",
            "loan_amount": "300000", "aadhaar": "123456789012",
        },
        "awaiting_field": "pan",
    }
    reply, new_stage = await handle_profile_collection("INVALIDPAN", "conv-10", conv_data)
    assert conv_data.get("awaiting_field") == "pan"
    assert "PAN" in reply or "format" in reply.lower()


@pytest.mark.asyncio
async def test_profile_collection_pan_validation_valid():
    conv_data = {
        "intent": "loan",
        "language": "en",
        "profile_fields": {
            "full_name": "Rajan", "mobile": "9876543210", "dob": "01/01/2000",
            "course": "B.Com", "institution": "Ravenshaw", "current_year": "2nd",
            "last_percentage": "60.0", "family_income": "1l_to_3l",
            "loan_amount": "300000", "aadhaar": "123456789012",
        },
        "awaiting_field": "pan",
    }
    reply, new_stage = await handle_profile_collection("ABCDE1234F", "conv-11", conv_data)
    assert conv_data["profile_fields"]["pan"] == "ABCDE1234F"
    assert conv_data.get("awaiting_field") == "category"


@pytest.mark.asyncio
async def test_profile_collection_loan_amount_skipped_for_scholarship_intent():
    """If intent is 'scholarship', loan_amount field should be skipped."""
    conv_data = {
        "intent": "scholarship",
        "language": "en",
        "profile_fields": {
            "full_name": "Priya", "mobile": "8765432109", "dob": "15/07/2002",
            "course": "B.Sc", "institution": "Utkal University", "current_year": "1st",
            "last_percentage": "72.0", "family_income": "under_1l",
        },
        "awaiting_field": "aadhaar",  # loan_amount should have been skipped
    }
    reply, _ = await handle_profile_collection("123456789012", "conv-12", conv_data)
    assert conv_data["profile_fields"]["aadhaar"] == "123456789012"
    # Should now ask PAN (not loan_amount since intent is scholarship)
    assert conv_data.get("awaiting_field") == "pan"


# ─── 6. All 12 fields are asked in correct order ──────────────────────────────

def test_profile_fields_order_with_loan_intent():
    """Verify all 12 fields are in the expected sequence for loan intent."""
    from app.agents.conversation_agent import PROFILE_FIELDS_ORDER
    expected = [
        "full_name", "mobile", "dob", "course", "institution",
        "current_year", "last_percentage", "family_income",
        "loan_amount",  # included for loan intent
        "aadhaar", "pan", "category",
    ]
    fields_for_loan = [
        f for f in PROFILE_FIELDS_ORDER
        if f != "loan_amount" or True  # loan intent includes it
    ]
    assert fields_for_loan == expected


# ─── 7. KYC stage transition ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_kyc_done_transitions_to_behavioral():
    conv_data = {"language": "en", "profile_fields": {"full_name": "Rajan"}}
    reply, new_stage = await handle_kyc_guidance("DONE", "conv-13", conv_data)
    assert new_stage == STAGE_BEHAVIORAL
    assert "8 questions" in reply.lower() or "yes" in reply.lower()


@pytest.mark.asyncio
async def test_kyc_uploaded_also_transitions():
    conv_data = {"language": "en", "profile_fields": {"full_name": "Priya"}}
    reply, new_stage = await handle_kyc_guidance("I have uploaded all documents", "conv-14", conv_data)
    assert new_stage == STAGE_BEHAVIORAL


@pytest.mark.asyncio
async def test_kyc_random_message_stays():
    conv_data = {"language": "en", "profile_fields": {"full_name": "Rajan"}}
    reply, new_stage = await handle_kyc_guidance("what documents do I need?", "conv-15", conv_data)
    assert new_stage is None
    assert "DONE" in reply


# ─── 8. Behavioral assessment flow ───────────────────────────────────────────

SAMPLE_QUESTIONS_MCQ = [
    {
        "question_id": f"q{i}",
        "question_text": f"Test MCQ question {i}?",
        "type": "mcq",
        "options": ["A opt", "B opt", "C opt", "D opt"],
        "dimension": "financial_responsibility",
    }
    for i in range(1, 9)
]

SAMPLE_QUESTIONS_MIXED = [
    {
        "question_id": f"q{i}",
        "question_text": f"Test question {i}?",
        "type": "mcq" if i <= 5 else "free_text",
        "options": ["A opt", "B opt", "C opt", "D opt"] if i <= 5 else None,
        "dimension": "financial_responsibility",
    }
    for i in range(1, 9)
]

# Default sample questions used by most behavioral tests
SAMPLE_QUESTIONS = SAMPLE_QUESTIONS_MCQ


@pytest.mark.asyncio
async def test_behavioral_first_yes_shows_question():
    conv_data = {
        "language": "en",
        "app_id": "app-test-001",
        "user_id": "user-test",
        "profile_fields": {"full_name": "Rajan"},
    }
    with patch("app.agents.conversation_agent._redis") as mock_redis, \
         patch("app.agents.conversation_agent._api_submit_behavioral", new=AsyncMock(return_value=True)):
        mock_redis.get_json = AsyncMock(return_value=SAMPLE_QUESTIONS)
        mock_redis.set_json = AsyncMock(return_value=None)

        reply, new_stage = await handle_behavioral_assessment("yes", "conv-16", conv_data)

    assert conv_data.get("behavioral_started") is True
    assert conv_data.get("current_question_index") == 0
    assert "Question 1 of 8" in reply
    assert "1." in reply  # MCQ options


@pytest.mark.asyncio
async def test_behavioral_mcq_invalid_answer_re_asks():
    conv_data = {
        "language": "en",
        "app_id": "app-test-001",
        "user_id": "user-test",
        "profile_fields": {"full_name": "Rajan"},
        "behavioral_started": True,
        "questions": SAMPLE_QUESTIONS,
        "current_question_index": 0,
        "behavioral_answers": [],
    }
    reply, new_stage = await handle_behavioral_assessment("5", "conv-17", conv_data)
    # Invalid MCQ answer (5 is out of range)
    assert conv_data.get("current_question_index") == 0  # index unchanged
    assert "1 to 4" in reply or "1, 2, 3" in reply
    assert new_stage is None


@pytest.mark.asyncio
async def test_behavioral_mcq_valid_answer_advances():
    conv_data = {
        "language": "en",
        "app_id": "app-test-001",
        "user_id": "user-test",
        "profile_fields": {"full_name": "Rajan"},
        "behavioral_started": True,
        "questions": SAMPLE_QUESTIONS,
        "current_question_index": 0,
        "behavioral_answers": [],
    }
    reply, new_stage = await handle_behavioral_assessment("3", "conv-18", conv_data)
    assert conv_data.get("current_question_index") == 1
    assert len(conv_data["behavioral_answers"]) == 1
    assert conv_data["behavioral_answers"][0]["answer"] == "2"  # 0-indexed
    assert "Question 2 of 8" in reply


@pytest.mark.asyncio
async def test_behavioral_free_text_too_short_re_asks():
    # Question 6 is free_text in SAMPLE_QUESTIONS_MIXED
    conv_data = {
        "language": "en",
        "app_id": "app-test-001",
        "user_id": "user-test",
        "profile_fields": {"full_name": "Rajan"},
        "behavioral_started": True,
        "questions": SAMPLE_QUESTIONS_MIXED,
        "current_question_index": 5,  # q6 is free_text
        "behavioral_answers": [
            {"qid": f"q{i}", "answer": str(i)} for i in range(1, 6)
        ],
    }
    reply, new_stage = await handle_behavioral_assessment("Short answer.", "conv-19", conv_data)
    # Too short — should ask to elaborate
    assert conv_data.get("current_question_index") == 5  # unchanged
    assert "more" in reply.lower() or "elaborate" in reply.lower() or "sentences" in reply.lower()
    assert new_stage is None


@pytest.mark.asyncio
async def test_behavioral_free_text_long_enough_advances():
    conv_data = {
        "language": "en",
        "app_id": "app-test-001",
        "user_id": "user-test",
        "profile_fields": {"full_name": "Rajan"},
        "behavioral_started": True,
        "questions": SAMPLE_QUESTIONS_MIXED,
        "current_question_index": 5,
        "behavioral_answers": [
            {"qid": f"q{i}", "answer": str(i)} for i in range(1, 6)
        ],
    }
    long_answer = " ".join(["word"] * 25)  # 25 words
    reply, new_stage = await handle_behavioral_assessment(long_answer, "conv-20", conv_data)
    assert conv_data.get("current_question_index") == 6
    assert len(conv_data["behavioral_answers"]) == 6


@pytest.mark.asyncio
async def test_behavioral_all_8_questions_submits():
    """After answering all 8 questions, agent submits and transitions to AWAITING."""
    conv_data = {
        "language": "en",
        "app_id": "app-test-001",
        "user_id": "user-test",
        "profile_fields": {"full_name": "Rajan"},
        "behavioral_started": True,
        "questions": SAMPLE_QUESTIONS,
        "current_question_index": 7,  # answering the last question
        "behavioral_answers": [
            {"qid": f"q{i}", "answer": str(i)} for i in range(1, 8)
        ],
    }
    with patch("app.agents.conversation_agent._api_submit_behavioral", new=AsyncMock(return_value=True)):
        reply, new_stage = await handle_behavioral_assessment("3", "conv-21", conv_data)

    assert new_stage == STAGE_AWAITING
    assert len(conv_data["behavioral_answers"]) == 8
    assert "thank" in reply.lower() or "potential" in reply.lower()


# ─── 9. Redis stage persistence via process_message ──────────────────────────

@pytest.mark.asyncio
async def test_process_message_stores_stage_in_redis():
    stored_stage = {}
    stored_data = {}

    async def mock_get_str(key):
        return stored_stage.get(key)

    async def mock_set_str(key, value, ttl):
        stored_stage[key] = value

    async def mock_get_json(key):
        return stored_data.get(key)

    async def mock_set_json(key, value, ttl):
        stored_data[key] = value

    conv_id = "test-stage-conv-001"

    with patch("app.agents.conversation_agent._redis") as mock_redis, \
         patch("app.agents.conversation_agent._api_put_profile", new=AsyncMock(return_value=True)), \
         patch("app.agents.conversation_agent._api_create_application", new=AsyncMock(return_value=None)):
        mock_redis.get_str = AsyncMock(side_effect=mock_get_str)
        mock_redis.set_str = AsyncMock(side_effect=mock_set_str)
        mock_redis.get_json = AsyncMock(side_effect=mock_get_json)
        mock_redis.set_json = AsyncMock(side_effect=mock_set_json)

        # First message → INTENT stage, welcome shown, no stage change
        reply1, stage1 = await process_message("hello", conv_id, "user-1")
        assert stage1 == STAGE_INTENT
        # Stage key not yet written (still INTENT, no transition)

        # Second message → answer intent question → transitions to PROFILE
        reply2, stage2 = await process_message("I want a loan", conv_id, "user-1")
        assert stage2 == STAGE_PROFILE
        # Check that stage was persisted
        assert stored_stage.get(f"conv_stage:{conv_id}") == STAGE_PROFILE


# ─── 10. POST_APPROVAL RAG response ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_post_approval_calls_llm_for_emi_question():
    conv_data = {
        "language": "en",
        "app_id": "app-test-001",
        "profile_fields": {
            "full_name": "Rajan Kumar",
            "course": "B.Com",
            "institution": "Ravenshaw University",
            "category": "sc",
            "family_income": "1l_to_3l",
        },
    }
    expected_reply = "Your EMI will be approximately ₹4,500 per month."
    with patch("app.agents.conversation_agent.call_llm", return_value=expected_reply):
        reply, new_stage = await handle_post_approval(
            "What will my EMI be after graduation?",
            "conv-22",
            conv_data,
        )
    assert reply == expected_reply
    assert new_stage is None


@pytest.mark.asyncio
async def test_post_approval_status_check_calls_api():
    conv_data = {
        "language": "en",
        "app_id": "app-approved-001",
        "profile_fields": {"full_name": "Priya"},
    }
    with patch(
        "app.agents.conversation_agent._api_get_app_status",
        new=AsyncMock(return_value="approved"),
    ):
        reply, new_stage = await handle_post_approval(
            "What is my application status?",
            "conv-23",
            conv_data,
        )
    assert "approved" in reply.lower()
    assert new_stage is None


# ─── 11. Full stage machine via process_message ───────────────────────────────

@pytest.mark.asyncio
async def test_full_intent_to_profile_transition():
    """Simulate two turns: welcome → intent answer → profile stage."""
    conv_id = "e2e-test-001"
    staged = {}
    data_store = {}

    async def get_str(key):
        return staged.get(key)

    async def set_str(key, val, ttl):
        staged[key] = val

    async def get_json(key):
        return data_store.get(key)

    async def set_json(key, val, ttl):
        data_store[key] = val

    with patch("app.agents.conversation_agent._redis") as r:
        r.get_str = AsyncMock(side_effect=get_str)
        r.set_str = AsyncMock(side_effect=set_str)
        r.get_json = AsyncMock(side_effect=get_json)
        r.set_json = AsyncMock(side_effect=set_json)

        # Turn 1: initial message
        reply1, s1 = await process_message("hi", conv_id)
        assert s1 == STAGE_INTENT
        assert "loan" in reply1.lower() or "scholarship" in reply1.lower()

        # Turn 2: answer intent → should transition to PROFILE
        reply2, s2 = await process_message("I want both", conv_id)
        assert s2 == STAGE_PROFILE
        assert staged.get(f"conv_stage:{conv_id}") == STAGE_PROFILE
        assert "name" in reply2.lower()  # asks for full name
