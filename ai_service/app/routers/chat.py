import asyncio
import logging
import uuid

from fastapi import APIRouter, Request

from app.config import get_settings
from app.models.requests import ChatRequest
from app.models.responses import ChatResponse
from app.services import qdrant_service, redis_service

logger = logging.getLogger(__name__)
router = APIRouter()

LANGUAGE_INSTRUCTION = {
    "en": "Respond in English.",
    "hi": "हिंदी में जवाब दें।",
    "od": "ଓଡ଼ିଆ ରେ ଉତ୍ତର ଦିଅ।",
}


@router.post("/message", response_model=ChatResponse)
async def chat_message(body: ChatRequest, request: Request) -> ChatResponse:
    settings = get_settings()
    conversation_id = body.conversation_id or str(uuid.uuid4())

    embedder = getattr(request.app.state, "embedder", None)
    embedding = None
    if embedder is not None:
        embedding = await asyncio.to_thread(embedder.encode, body.message)
        embedding = embedding.tolist()

    results = []
    if embedding:
        results = await qdrant_service.search("loan_policies", embedding, limit=3)

    context = "\n\n".join(
        r.payload.get("text", "") for r in results if hasattr(r, "payload") and r.payload.get("text")
    )

    history = await redis_service.get_json(f"chat:{conversation_id}") or []

    lang_instr = LANGUAGE_INSTRUCTION.get(body.language, LANGUAGE_INSTRUCTION["en"])
    system = (
        "You are a helpful student loan and scholarship assistant for Indian students. "
        "Be concise, accurate, and empathetic. "
        f"{lang_instr} "
        "Use the provided context to answer. If context is insufficient, use your knowledge about "
        "Indian education loan schemes."
    )

    messages_for_llm = history[-10:] + [{"role": "user", "content": body.message}]

    full_prompt = body.message
    if context:
        full_prompt = f"Context:\n{context}\n\nQuestion: {body.message}"

    reply = settings.make_llm_call(full_prompt, system=system, max_tokens=500)

    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": reply})
    history = history[-10:]

    await redis_service.set_json(f"chat:{conversation_id}", history, ttl=86400)

    sources = [
        r.payload.get("source", "")
        for r in results
        if hasattr(r, "payload") and r.payload.get("source")
    ]

    return ChatResponse(reply=reply, sources=sources, conversation_id=conversation_id)
