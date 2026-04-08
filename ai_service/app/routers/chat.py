import asyncio
import logging
import uuid

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

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

    # Read current stage from Redis at the start of every request.
    # Default to "GREETING" (mapped to INTENT) if key missing or Redis unavailable.
    try:
        stage = await redis_service.get_str(f"conv_stage:{conversation_id}") or "GREETING"
    except Exception:
        stage = "GREETING"
    logger.info("[CHAT] conversation_id=%s current_stage=%s", conversation_id, stage)

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


@router.post("/stream")
async def chat_stream(body: ChatRequest, request: Request) -> StreamingResponse:
    """SSE streaming endpoint — frontend calls this via sendChatStream()."""
    from app.services import qdrant_service as qdrant_svc
    import json

    conversation_id = body.conversation_id or str(uuid.uuid4())
    embedder = getattr(request.app.state, "embedder", None)

    reply, current_stage = await process_message(
        message=body.message,
        conversation_id=conversation_id,
        user_id=body.user_id,
        embedder=embedder,
        qdrant_service=qdrant_svc,
    )

    # Persist history
    history = await redis_service.get_json(f"chat:{conversation_id}")
    if not isinstance(history, list):
        history = []
    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": reply})
    history = history[-20:]
    await redis_service.set_json(f"chat:{conversation_id}", history, ttl=86400)

    async def event_generator():
        # Stream word-by-word for a realistic typewriter effect
        words = reply.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == len(words) - 1 else word + " "
            payload = json.dumps({"text": chunk, "session_id": conversation_id})
            yield f"data: {payload}\n\n"
            await asyncio.sleep(0.02)  # 20ms per word
        done_payload = json.dumps({
            "text": "",
            "session_id": conversation_id,
            "current_stage": current_stage,
        })
        yield f"data: {done_payload}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/reset")
async def reset_conversation(conversation_id: str = Query(..., description="Conversation ID to reset")) -> dict:
    """Delete Redis keys for the given conversation, resetting it to the initial INTENT stage."""
    try:
        await redis_service.delete(f"conv_stage:{conversation_id}")
    except Exception:
        pass
    try:
        await redis_service.delete(f"conv_data:{conversation_id}")
    except Exception:
        pass
    logger.info("[CHAT] reset conversation_id=%s", conversation_id)
    return {"status": "reset", "conversation_id": conversation_id}
