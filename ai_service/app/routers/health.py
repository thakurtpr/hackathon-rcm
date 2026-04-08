import logging
import time
from typing import Any, Dict

import redis.asyncio as aioredis
from fastapi import APIRouter, Request
from minio import Minio

from app.config import get_settings
from app.models.responses import HealthResponse
from app.services import qdrant_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings = get_settings()
    models_loaded = getattr(request.app.state, "models_loaded", False)
    risk_model_loaded = getattr(request.app.state, "risk_model_loaded", False)

    # Qdrant
    qdrant_ok = False
    try:
        await qdrant_service.search("scholarships", [0.0] * 384, limit=1)
        qdrant_ok = True
    except Exception:
        pass

    # Kafka
    kafka_task = getattr(request.app.state, "kafka_task", None)
    kafka_connected = kafka_task is not None and not kafka_task.done()

    # Redis
    redis_ok = False
    try:
        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        redis_ok = True
    except Exception:
        pass

    # MinIO
    minio_ok = False
    try:
        host_port = settings.minio_endpoint.split(":")
        host = host_port[0]
        port = int(host_port[1]) if len(host_port) > 1 else 9000
        client = Minio(
            f"{host}:{port}",
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=False,
        )
        client.bucket_exists(settings.minio_bucket)
        minio_ok = True
    except Exception:
        pass

    # Overall status
    critical_checks = [qdrant_ok, models_loaded]
    status = "ok" if all(critical_checks) else "degraded"

    return HealthResponse(
        status=status,
        models_loaded=models_loaded,
        kafka_connected=kafka_connected,
        qdrant_connected=qdrant_ok,
        llm_provider=settings.llm_provider,
        redis_connected=redis_ok,
        minio_connected=minio_ok,
        risk_model_loaded=risk_model_loaded,
    )


@router.get("/health/groq")
async def health_groq(request: Request) -> Dict[str, Any]:
    """Make a real Groq API call to verify the connection is live."""
    settings = get_settings()
    model = settings.groq_model
    probe_prompt = "Say 'hello' in exactly one word."

    start = time.monotonic()
    try:
        from groq import Groq  # type: ignore

        def _call() -> str:
            client = Groq(api_key=settings.groq_api_key)
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": probe_prompt}],
                max_tokens=10,
            )
            return response.choices[0].message.content or ""

        import asyncio
        response_text = await asyncio.to_thread(_call)
        latency_ms = (time.monotonic() - start) * 1000
        logger.info(
            "GROQ_HEALTH_CHECK: model=%s latency_ms=%.1f response=%r",
            model, latency_ms, response_text,
        )
        return {
            "groq_available": True,
            "latency_ms": round(latency_ms, 1),
            "response": response_text,
            "model": model,
        }
    except Exception as exc:
        latency_ms = (time.monotonic() - start) * 1000
        logger.warning(
            "GROQ_HEALTH_CHECK failed: model=%s latency_ms=%.1f error=%s",
            model, latency_ms, exc,
        )
        return {
            "groq_available": False,
            "error": str(exc),
        }
