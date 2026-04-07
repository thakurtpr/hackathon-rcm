import logging

from app.config import get_settings
from app.models.responses import KYCResult
from app.pipelines import (
    behavioral_pipeline,
    face_match_pipeline,
    fraud_pipeline,
    ocr_pipeline,
    scholarship_pipeline,
)
from app.agents import orchestrator
from app.kafka import producer as kafka_producer
from app.services import backend_client, minio_client, redis_service, qdrant_service

logger = logging.getLogger(__name__)

# These are set from main.py lifespan after models are loaded
insightface_app = None
embedder = None


async def handle_doc_uploaded(event: dict) -> None:
    payload = event.get("payload", {})
    doc_id = payload.get("doc_id", "")
    user_id = payload.get("user_id", "")
    doc_type = payload.get("doc_type", "")
    minio_path = payload.get("minio_path", "")
    app_id = payload.get("app_id", event.get("app_id", ""))
    settings = get_settings()

    result = await ocr_pipeline.run(minio_path, doc_type, minio_client, settings.make_llm_call)

    kyc_payload = KYCResult(
        user_id=user_id,
        doc_id=doc_id,
        doc_type=doc_type,
        ocr_extracted=result["ocr_extracted"],
        doc_authentic=result["doc_authentic"],
        doc_trust_score=result["doc_trust_score"],
    )

    if doc_type in ("aadhaar", "selfie"):
        this_key = f"{'aadhaar' if doc_type == 'aadhaar' else 'selfie'}_path:{user_id}"
        other_key = f"{'selfie' if doc_type == 'aadhaar' else 'aadhaar'}_path:{user_id}"
        await redis_service.set_str(this_key, minio_path, ttl=3600)
        other_path = await redis_service.get_str(other_key)
        if other_path and insightface_app is not None:
            aadhaar_p = minio_path if doc_type == "aadhaar" else other_path
            selfie_p = other_path if doc_type == "aadhaar" else minio_path
            face_result = await face_match_pipeline.run(
                aadhaar_p, selfie_p, minio_client, insightface_app, qdrant_service, user_id, app_id
            )
            kyc_payload.face_match_score = face_result.face_match_score
            kyc_payload.face_match_pass = face_result.face_match_pass

    await backend_client.post_kyc_result(kyc_payload)
    await kafka_producer.produce(
        "kyc.verified",
        {
            "app_id": app_id,
            "user_id": user_id,
            "doc_trust_score": result["doc_trust_score"],
            "face_match_pass": kyc_payload.face_match_pass,
        },
    )


async def handle_app_submitted(event: dict) -> None:
    payload = event.get("payload", {})
    app_id = payload.get("app_id", event.get("app_id", ""))
    user_id = payload.get("user_id", event.get("user_id", ""))
    settings = get_settings()

    profile = await backend_client.get_profile(user_id) or {}

    await behavioral_pipeline.generate_questions(profile, app_id, redis_service, settings.make_llm_call)

    pan_number = profile.get("pan_number", "")
    aadhaar_number = profile.get("aadhaar_number", "")
    face_emb_raw = await redis_service.get_json(f"face_embedding:{user_id}") or []
    selfie_embedding = face_emb_raw if isinstance(face_emb_raw, list) else []

    fraud_result = await fraud_pipeline.run_all(
        app_id=app_id,
        user_id=user_id,
        pan_number=pan_number,
        aadhaar_number=aadhaar_number,
        mobile=profile.get("mobile", ""),
        doc_ids=[],
        selfie_embedding=selfie_embedding,
        backend_client=backend_client,
        qdrant_service=qdrant_service,
    )

    await backend_client.post_fraud_result(fraud_result)
    await kafka_producer.produce(
        "fraud.checked",
        {
            "app_id": app_id,
            "user_id": user_id,
            "fraud_flag": fraud_result.fraud_flag,
            "fraud_reasons": fraud_result.fraud_reasons,
        },
    )


async def handle_eligibility_done(event: dict) -> None:
    payload = event.get("payload", {})
    app_id = payload.get("app_id", event.get("app_id", ""))
    user_id = payload.get("user_id", event.get("user_id", ""))
    composite_score = float(payload.get("composite_score", 0))
    band = payload.get("band", "review")
    settings = get_settings()

    scholarship_result = await scholarship_pipeline.match(
        user_id=user_id,
        app_id=app_id,
        backend_client=backend_client,
        qdrant_service=qdrant_service,
        embedder=embedder,
        llm_call_fn=settings.make_llm_call,
    )
    await backend_client.post_scholarship_result(scholarship_result)

    profile = await backend_client.get_profile(user_id) or {}
    behavioral_cache = await redis_service.get_json(f"behavioral_result:{app_id}") or {}
    pq_score = float(behavioral_cache.get("pq_score", 0.0))

    await orchestrator.run(
        app_id=app_id,
        user_id=user_id,
        composite_score=composite_score,
        band=band,
        pq_score=pq_score,
        profile=profile,
        doc_statuses={},
        fraud_flag=False,
        backend_client=backend_client,
        llm_call_fn=settings.make_llm_call,
    )

    await kafka_producer.produce(
        "approval.decided",
        {
            "app_id": app_id,
            "user_id": user_id,
            "decision": band,
            "approved_amount": profile.get("loan_amount"),
            "reason": "See explanation result",
        },
    )
