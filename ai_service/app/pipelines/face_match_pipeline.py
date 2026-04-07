import asyncio
import hashlib
import logging
from io import BytesIO
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from app.models.responses import FaceMatchResult
from app.config import get_settings

logger = logging.getLogger(__name__)

# Module-level InsightFace instance (buffalo_l model loaded once at startup)
_insightface_app: Optional[object] = None


def init_insightface() -> object:
    """Load buffalo_l model at module startup. Call once from lifespan."""
    global _insightface_app
    if _insightface_app is None:
        import insightface  # type: ignore
        app = insightface.app.FaceAnalysis("buffalo_l")
        app.prepare(ctx_id=0, det_size=(640, 640))
        _insightface_app = app
    return _insightface_app


def get_embedding(image_path: str) -> np.ndarray:
    """Return the face embedding vector for an image file path (synchronous)."""
    face_app = _insightface_app
    if face_app is None:
        raise RuntimeError("InsightFace not initialized. Call init_insightface() first.")
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")
    faces = face_app.get(img)
    if not faces:
        raise ValueError(f"No face detected in: {image_path}")
    emb = faces[0].embedding.astype(np.float32)
    return emb / (np.linalg.norm(emb) + 1e-8)


def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    """Compute cosine similarity between two normalised or un-normalised embeddings."""
    n1 = emb1 / (np.linalg.norm(emb1) + 1e-8)
    n2 = emb2 / (np.linalg.norm(emb2) + 1e-8)
    return float(np.dot(n1, n2))


def match_faces(aadhaar_path: str, selfie_path: str) -> dict:
    """
    Compare aadhaar photo vs selfie using InsightFace embeddings.

    Returns:
        {"result": "verified", "similarity": 0.91}     if similarity >= 0.85
        {"result": "manual_review", "similarity": 0.75} if 0.70 <= similarity < 0.85
        {"result": "failed", "similarity": 0.60}        if similarity < 0.70
    """
    settings = get_settings()
    emb_a = get_embedding(aadhaar_path)
    emb_b = get_embedding(selfie_path)
    sim = cosine_similarity(emb_a, emb_b)
    sim_rounded = round(sim, 4)

    if sim >= settings.face_match_threshold:
        result = "verified"
    elif sim >= settings.face_match_manual_review_threshold:
        result = "manual_review"
    else:
        result = "failed"

    return {"result": result, "similarity": sim_rounded}


async def run(
    aadhaar_path: str,
    selfie_path: str,
    minio_client,
    insightface_app,
    qdrant_service,
    user_id: str,
    app_id: str,
) -> FaceMatchResult:
    # If InsightFace model is not loaded yet, return graceful response
    if insightface_app is None:
        logger.warning("InsightFace model not loaded — face match unavailable")
        return FaceMatchResult(
            face_match_score=0.0,
            face_match_pass=False,
            flag="model_not_loaded",
            message="face match model is loading please retry in 60 seconds",
        )

    try:
        settings = get_settings()
        aadhaar_bytes, selfie_bytes = await asyncio.gather(
            minio_client.fetch_file(aadhaar_path),
            minio_client.fetch_file(selfie_path),
        )

        def _to_bgr(raw: bytes) -> np.ndarray:
            pil_img = Image.open(BytesIO(raw)).convert("RGB")
            rgb_arr = np.array(pil_img)
            return cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)

        aadhaar_np, selfie_np = await asyncio.gather(
            asyncio.to_thread(_to_bgr, aadhaar_bytes),
            asyncio.to_thread(_to_bgr, selfie_bytes),
        )

        faces_a = await asyncio.to_thread(insightface_app.get, aadhaar_np)
        faces_b = await asyncio.to_thread(insightface_app.get, selfie_np)

        if not faces_a or not faces_b:
            return FaceMatchResult(
                face_match_score=0.0,
                face_match_pass=False,
                flag="no_face_detected",
            )

        emb_a = faces_a[0].embedding.astype(np.float32)
        emb_a = emb_a / (np.linalg.norm(emb_a) + 1e-8)

        emb_b = faces_b[0].embedding.astype(np.float32)
        emb_b = emb_b / (np.linalg.norm(emb_b) + 1e-8)

        score = float(np.dot(emb_a, emb_b))

        if score >= settings.face_match_threshold:
            flag = "passed"
            face_match_pass = True
        elif score >= settings.face_match_manual_review_threshold:
            flag = "manual_review"
            face_match_pass = False
        else:
            flag = "failed"
            face_match_pass = False

        uid_hash = hashlib.sha256(user_id.encode()).hexdigest()
        await qdrant_service.upsert(
            "face_embeddings",
            uid_hash,
            emb_b.tolist(),
            {"user_id": user_id, "app_id": app_id},
        )

        return FaceMatchResult(
            face_match_score=round(score, 4),
            face_match_pass=face_match_pass,
            flag=flag,
        )

    except Exception as exc:
        logger.error("Face match pipeline failed: %s", exc)
        return FaceMatchResult(face_match_score=0.0, face_match_pass=False, flag="failed")
