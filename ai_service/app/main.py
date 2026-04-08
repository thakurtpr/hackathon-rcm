import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.kafka.consumer import start_kafka_consumer
from app.routers.behavioral import router as behavioral_router
from app.routers.chat import router as chat_router
from app.routers.fraud import router as fraud_router
from app.routers.health import router as health_router
from app.routers.ocr import router as ocr_router
from app.routers.roi import router as roi_router
from app.services import minio_client, qdrant_service
from app.services.risk_model import load_model as load_risk_model

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


_LOAN_POLICIES = [
    {"id": "p001", "source": "RBI Education Loan Circular 2013", "text": "RBI education loan circular 2013 guidelines: Education loans cover tuition fees, examination fees, library and laboratory fees, purchase of books, equipment, instruments, uniforms. Travel expenses, study tours, project work, and thesis expenses are also eligible. Margin: nil for loans up to ₹4 lakh; 5% for domestic loans above ₹4 lakh; 15% for abroad."},
    {"id": "p002", "source": "CSIS Central Interest Subsidy Scheme", "text": "Central Scheme to provide Interest Subsidy (CSIS): Eligibility for students from EWS with annual family income up to ₹4.5 lakh. Interest subsidy during moratorium period for loans up to ₹7.5 lakh."},
    {"id": "p003", "source": "Vidya Lakshmi Portal", "text": "Vidya Lakshmi portal: Students register with Aadhaar-linked mobile, complete CAF once and apply to multiple banks. Linked with National Scholarship Portal."},
    {"id": "p004", "source": "IBA Model Education Loan Scheme", "text": "IBA Model Education Loan Scheme: Loans up to ₹10 lakh for India, ₹20 lakh for abroad. No collateral for loans up to ₹7.5 lakh. Repayment 5-15 years."},
    {"id": "p005", "source": "PM Vidya Lakshmi Scheme 2024", "text": "PM Vidya Lakshmi: Loans up to ₹10 lakh with 3% interest subvention for family income up to ₹8 lakh. No collateral needed. Students in NAAC/NIRF-ranked institutions in India."},
    {"id": "p006", "source": "RBI Repayment Holiday Rules", "text": "Repayment starts one year after course completion or six months after securing employment, whichever is earlier. Banks cannot demand repayment before moratorium ends."},
    {"id": "p007", "source": "RBI Prepayment Rules", "text": "No prepayment penalty on education loans with floating interest rates. Foreclosure permitted without penalty on floating-rate loans."},
    {"id": "p008", "source": "Income Tax Section 80E", "text": "Section 80E: Deduction on education loan interest for 8 consecutive years. No upper limit. Applies to loans for self, spouse, children, or legal ward."},
    {"id": "p009", "source": "IBA Eligible Courses", "text": "Eligible courses: graduation, post-graduation, professional courses, technical diplomas from UGC/AICTE/IMC-approved institutions. Includes medicine, engineering, management, law, agriculture."},
    {"id": "p010", "source": "RBI Documentation Requirements", "text": "Documents required: application form, Aadhaar, PAN, academic records, admission letter, fee structure, income proof, bank statements. Collateral required above ₹7.5 lakh."},
]


async def seed_loan_policies(embedder, qdrant_svc) -> None:
    import hashlib
    for p in _LOAN_POLICIES:
        embedding = await asyncio.to_thread(embedder.encode, p["text"])
        uid = str(int(hashlib.md5(p["id"].encode()).hexdigest(), 16) % (2**63))
        await qdrant_svc.upsert("loan_policies", uid, embedding.tolist(), p)
    logger.info("Seeded %d loan policy documents", len(_LOAN_POLICIES))


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

    # 1. Face matching uses DeepFace (no pre-init needed)
    logger.info("Face matching: DeepFace SFace backend (lazy-loaded on first use)")
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

    # 3. OCR uses pytesseract (PaddleOCR removed — caused SIGSEGV in Docker)
    logger.info("OCR engine: pytesseract (ready)")
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

        # Seed loan_policies if empty (P1 fix — previously only done by demo_seed.py)
        policy_check = await qdrant_service.search("loan_policies", [0.0] * 384, limit=1)
        if not policy_check:
            logger.info("Seeding loan_policies into Qdrant...")
            await seed_loan_policies(app.state.embedder, qdrant_service)
            logger.info("Loan policies seeded ✓")

    # 7. Load XGBoost Risk Model
    logger.info("Loading XGBoost risk model...")
    try:
        risk_loaded = await asyncio.to_thread(load_risk_model)
        app.state.risk_model_loaded = risk_loaded
        logger.info("Risk model loaded ✓" if risk_loaded else "Risk model unavailable (rule-based fallback)")
    except Exception as exc:
        logger.warning("Risk model load failed (non-fatal): %s", exc)
        app.state.risk_model_loaded = False

    # 8. Validate Groq API key
    groq_key = settings.groq_api_key
    placeholder_keys = {"gsk_xxxx", "YOUR_GROQ_API_KEY", "YOUR_GROQ_API_KEY_FROM_CONSOLE_GROQ_COM"}
    if not groq_key or groq_key in placeholder_keys or groq_key.startswith("gsk_xxxx"):
        logger.critical(
            "GROQ_API_KEY is missing or is a placeholder — Groq calls will NOT work. "
            "Set a real key in .env or as an environment variable."
        )
        app.state.groq_available = False
    else:
        logger.info("Groq API key detected (prefix: %s...) — provider=groq", groq_key[:8])
        app.state.groq_available = True

    # 9. Start Kafka consumer
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
app.include_router(roi_router, prefix="/roi")
app.include_router(ocr_router)
