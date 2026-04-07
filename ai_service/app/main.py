import asyncio
import logging
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.kafka.consumer import start_kafka_consumer
from app.routers.behavioral import router as behavioral_router
from app.routers.chat import router as chat_router
from app.routers.fraud import router as fraud_router
from app.routers.health import router as health_router
from app.services import minio_client, qdrant_service
from app.services.risk_model import load_model as load_risk_model

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


async def seed_scholarships(embedder, qdrant_svc) -> None:
    import json
    import os

    data_path = os.path.join(os.path.dirname(__file__), "../data/scholarships.json")
    if not os.path.exists(data_path):
        logger.warning("scholarships.json not found at %s", data_path)
        return

    with open(data_path) as f:
        scholarships = json.load(f)

    for s in scholarships:
        text = s.get("description", s.get("name", ""))
        embedding = await asyncio.to_thread(embedder.encode, text)
        await qdrant_svc.upsert(
            "scholarships",
            s["id"],
            embedding.tolist(),
            s,
        )
    logger.info("Seeded %d scholarships", len(scholarships))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──
    logger.info("=== AI Service starting up ===")
    settings = get_settings()

    # 1. Load InsightFace
    logger.info("Loading InsightFace buffalo_l...")
    logger.info("InsightFace buffalo_l model downloading approximately 400MB — this only happens once")
    try:
        from insightface.app import FaceAnalysis  # type: ignore
        face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        try:
            face_app.prepare(ctx_id=0, det_size=(640, 640))
        except Exception as prepare_exc:
            logger.warning("face_app.prepare failed — face match will be unavailable: %s", prepare_exc)
            app.state.insightface = None
            app.state.face_app = None
            face_app = None

        if face_app is not None:
            app.state.insightface = face_app
            app.state.face_app = face_app
            from app.kafka import handlers
            handlers.insightface_app = face_app
            logger.info("InsightFace loaded ✓")
    except Exception as exc:
        logger.warning("InsightFace failed to load — face match will be unavailable: %s", exc)
        app.state.insightface = None
        app.state.face_app = None

    # 2. Load SentenceTransformer
    logger.info("Loading sentence-transformers all-MiniLM-L6-v2...")
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        app.state.embedder = embedder

        from app.kafka import handlers
        handlers.embedder = embedder
        logger.info("SentenceTransformer loaded ✓")
    except Exception as exc:
        logger.warning("SentenceTransformer failed to load (non-fatal): %s", exc)
        app.state.embedder = None

    # 3. Pre-warm PaddleOCR
    logger.info("Pre-warming PaddleOCR...")
    try:
        from paddleocr import PaddleOCR  # type: ignore
        dummy_img = np.zeros((100, 300, 3), dtype=np.uint8)
        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        await asyncio.to_thread(ocr.ocr, dummy_img, cls=True)
        app.state.ocr = ocr
        logger.info("PaddleOCR ready ✓")
    except Exception as exc:
        logger.warning("PaddleOCR failed to load (non-fatal): %s", exc)
        app.state.ocr = None

    # 4. Initialize Qdrant collections
    logger.info("Initializing Qdrant collections...")
    await qdrant_service.ensure_collection("scholarships", 384, "Cosine")
    await qdrant_service.ensure_collection("loan_policies", 384, "Cosine")
    await qdrant_service.ensure_collection("face_embeddings", 512, "Cosine")
    logger.info("Qdrant collections ready ✓")

    # 5. Ensure MinIO bucket
    await minio_client.ensure_bucket(settings.minio_bucket)

    # 6. Seed scholarships if empty
    if app.state.embedder is not None:
        scholarship_check = await qdrant_service.search("scholarships", [0.0] * 384, limit=1)
        if not scholarship_check:
            logger.info("Seeding scholarships into Qdrant...")
            await seed_scholarships(app.state.embedder, qdrant_service)
            logger.info("Scholarships seeded ✓")

    # 7. Load XGBoost Risk Model
    logger.info("Loading XGBoost risk model...")
    try:
        risk_loaded = await asyncio.to_thread(load_risk_model)
        app.state.risk_model_loaded = risk_loaded
        logger.info("Risk model loaded ✓" if risk_loaded else "Risk model unavailable (rule-based fallback)")
    except Exception as exc:
        logger.warning("Risk model load failed (non-fatal): %s", exc)
        app.state.risk_model_loaded = False

    # 8. Start Kafka consumer
    app.state.kafka_task = asyncio.create_task(start_kafka_consumer(app))
    logger.info("Kafka consumer started ✓")

    app.state.models_loaded = True
    logger.info("=== AI Service ready on port %d ===", settings.ai_service_port)

    yield

    # ── SHUTDOWN ──
    kafka_task = getattr(app.state, "kafka_task", None)
    if kafka_task:
        kafka_task.cancel()
    logger.info("AI Service shut down cleanly")


app = FastAPI(title="Hackforge AI Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(behavioral_router, prefix="/behavioral")
app.include_router(chat_router, prefix="/chat")
app.include_router(fraud_router)
