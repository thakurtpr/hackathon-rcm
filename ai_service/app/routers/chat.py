import logging
import uuid

from fastapi import APIRouter, Request

from app.agents.conversation_agent import process_message
from app.models.requests import ChatRequest
from app.models.responses import ChatResponse
from app.services import redis_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/message", response_model=ChatResponse)
async def chat_message(body: ChatRequest, request: Request) -> ChatResponse:
    from app.services import qdrant_service as qdrant_svc

    conversation_id = body.conversation_id or str(uuid.uuid4())
    embedder = getattr(request.app.state, "embedder", None)

    reply, current_stage = await process_message(
        message=body.message,
        conversation_id=conversation_id,
        user_id=body.user_id,
        embedder=embedder,
        qdrant_service=qdrant_svc,
    )

    # Persist chat history (last 10 turns = 20 messages)
    history = await redis_service.get_json(f"chat:{conversation_id}")
    if not isinstance(history, list):
        history = []
    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": reply})
    history = history[-20:]
    await redis_service.set_json(f"chat:{conversation_id}", history, ttl=86400)

    return ChatResponse(
        reply=reply,
        sources=[],
        conversation_id=conversation_id,
        current_stage=current_stage,
    )
