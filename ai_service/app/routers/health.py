import logging

from fastapi import APIRouter, Request

from app.config import get_settings
from app.models.responses import HealthResponse
from app.services import qdrant_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings = get_settings()
    models_loaded = getattr(request.app.state, "models_loaded", False)

    qdrant_ok = False
    try:
        results = await qdrant_service.search("scholarships", [0.0] * 384, limit=1)
        qdrant_ok = True
    except Exception:
        qdrant_ok = False

    kafka_task = getattr(request.app.state, "kafka_task", None)
    kafka_connected = kafka_task is not None and not kafka_task.done()

    return HealthResponse(
        status="ok",
        models_loaded=models_loaded,
        kafka_connected=kafka_connected,
        qdrant_connected=qdrant_ok,
        llm_provider=settings.llm_provider,
    )
