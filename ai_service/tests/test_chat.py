"""Tests for POST /chat/message endpoint (stage-driven conversation agent)."""
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ─── Fixture: minimal FastAPI app with chat router ───────────────────────────

@pytest.fixture
def chat_app():
    from app.routers.chat import router
    app = FastAPI()
    app.include_router(router, prefix="/chat")
    mock_embedder = MagicMock()
    embed_result = MagicMock()
    embed_result.tolist = lambda: [0.1] * 384
    mock_embedder.encode = MagicMock(return_value=embed_result)
    app.state.embedder = mock_embedder
    return app


@pytest.fixture
def chat_client(chat_app):
    return TestClient(chat_app)


def _mock_process(reply="Welcome! Are you looking for a loan, scholarship, or both?", stage="INTENT"):
    """Patch process_message to return a fixed reply and stage."""
    return patch(
        "app.routers.chat.process_message",
        new=AsyncMock(return_value=(reply, stage)),
    )


def _mock_redis():
    return (
        patch("app.routers.chat.redis_service.get_json", new=AsyncMock(return_value=[])),
        patch("app.routers.chat.redis_service.set_json", new=AsyncMock(return_value=None)),
    )


# ─── 1. POST /chat/message returns reply, conversation_id, current_stage ─────

def test_chat_message_returns_reply_and_stage(chat_client):
    r_get, r_set = _mock_redis()
    with _mock_process("Hello! Are you looking for a loan or scholarship?", "INTENT"), r_get, r_set:
        resp = chat_client.post("/chat/message", json={"message": "hello"})

    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert "conversation_id" in data
    assert "current_stage" in data
    assert data["current_stage"] == "INTENT"
    assert len(data["reply"]) > 0


# ─── 2. conversation_id is auto-generated when not provided ──────────────────

def test_chat_message_generates_conversation_id_when_missing(chat_client):
    r_get, r_set = _mock_redis()
    with _mock_process(), r_get, r_set:
        resp = chat_client.post("/chat/message", json={"message": "hi"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["conversation_id"] is not None
    assert len(data["conversation_id"]) > 0


# ─── 3. Provided conversation_id is passed through ───────────────────────────

def test_chat_message_uses_provided_conversation_id(chat_client):
    provided_id = "my-conv-123"
    r_get, r_set = _mock_redis()
    with _mock_process(), r_get, r_set:
        resp = chat_client.post("/chat/message", json={
            "message": "hello",
            "conversation_id": provided_id,
        })

    assert resp.status_code == 200
    assert resp.json()["conversation_id"] == provided_id


# ─── 4. History is stored in Redis ───────────────────────────────────────────

def test_chat_message_updates_history_in_redis(chat_client):
    stored = {}

    async def fake_set_json(key, value, ttl):
        stored[key] = value

    with _mock_process("Great! What is your full name?", "PROFILE_COLLECTION"), \
         patch("app.routers.chat.redis_service.get_json", new=AsyncMock(return_value=[])), \
         patch("app.routers.chat.redis_service.set_json", new=AsyncMock(side_effect=fake_set_json)):

        resp = chat_client.post("/chat/message", json={
            "message": "I want a loan",
            "conversation_id": "conv-history-test",
        })

    assert resp.status_code == 200
    history_key = "chat:conv-history-test"
    assert history_key in stored
    history = stored[history_key]
    assert any(m["role"] == "user" for m in history)
    assert any(m["role"] == "assistant" for m in history)
    user_msg = next(m for m in history if m["role"] == "user")
    assert user_msg["content"] == "I want a loan"


# ─── 5. user_id is forwarded to process_message ──────────────────────────────

def test_chat_message_forwards_user_id(chat_client):
    captured = {}

    async def fake_process(message, conversation_id, user_id=None, **kwargs):
        captured["user_id"] = user_id
        return ("Reply", "INTENT")

    r_get, r_set = _mock_redis()
    with patch("app.routers.chat.process_message", new=fake_process), r_get, r_set:
        resp = chat_client.post("/chat/message", json={
            "message": "hello",
            "user_id": "user-abc-123",
        })

    assert resp.status_code == 200
    assert captured.get("user_id") == "user-abc-123"


# ─── 6. sources is always an empty list in the new implementation ─────────────

def test_chat_message_sources_is_empty_list(chat_client):
    r_get, r_set = _mock_redis()
    with _mock_process(), r_get, r_set:
        resp = chat_client.post("/chat/message", json={"message": "what documents?"})

    assert resp.status_code == 200
    assert resp.json()["sources"] == []


# ─── 7. Stage transitions are reflected in response ──────────────────────────

def test_chat_message_profile_stage_in_response(chat_client):
    r_get, r_set = _mock_redis()
    with _mock_process("Great! What is your full name?", "PROFILE_COLLECTION"), r_get, r_set:
        resp = chat_client.post("/chat/message", json={"message": "I want a loan"})

    assert resp.status_code == 200
    assert resp.json()["current_stage"] == "PROFILE_COLLECTION"


# ─── 8. Request body accepts language parameter ───────────────────────────────

def test_chat_message_accepts_language_param(chat_client):
    r_get, r_set = _mock_redis()
    with _mock_process("नमस्ते!", "INTENT"), r_get, r_set:
        resp = chat_client.post("/chat/message", json={
            "message": "मुझे लोन चाहिए",
            "language": "hi",
        })

    assert resp.status_code == 200
    assert resp.json()["reply"] == "नमस्ते!"
