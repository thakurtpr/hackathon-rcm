"""
Face match pipeline using DeepFace (SFace backend via OpenCV).

Replaces InsightFace buffalo_l (~400MB) with DeepFace SFace (~37MB).
Model is auto-downloaded on first use to ~/.deepface/weights/.

SFace achieves ~99.4% accuracy on LFW benchmark — suitable for KYC.
"""
import asyncio
import logging
import tempfile
import os
from io import BytesIO
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from app.models.responses import FaceMatchResult
from app.config import get_settings

logger = logging.getLogger(__name__)


def _save_temp_image(image_bytes: bytes, suffix: str = ".jpg") -> str:
    """Write bytes to a temp file and return path (caller must delete)."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(image_bytes)
    tmp.close()
    return tmp.name


def _bytes_to_bgr(raw: bytes) -> np.ndarray:
    """Convert raw image bytes → OpenCV BGR ndarray."""
    pil_img = Image.open(BytesIO(raw)).convert("RGB")
    rgb_arr = np.array(pil_img)
    return cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)


def _detect_face_opencv(bgr: np.ndarray) -> bool:
    """Quick sanity check: does this image contain at least one face?"""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(cascade_path)
    faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    return len(faces) > 0


def _deepface_verify(img1_path: str, img2_path: str, threshold: float) -> dict:
    """
    Run DeepFace.verify() synchronously (called via asyncio.to_thread).

    Returns:
        {"verified": bool, "distance": float, "similarity": float}
    """
    from deepface import DeepFace  # type: ignore

    result = DeepFace.verify(
        img1_path=img1_path,
        img2_path=img2_path,
        model_name="SFace",
        detector_backend="opencv",  # fast, no extra deps
        enforce_detection=False,    # don't raise if face not found — we check separately
        align=True,
        distance_metric="cosine",
    )
    distance = float(result.get("distance", 1.0))
    # Convert cosine distance to similarity: similarity = 1 - distance
    similarity = round(1.0 - distance, 4)
    verified = result.get("verified", False)
    return {"verified": verified, "distance": distance, "similarity": similarity}


async def run(
    aadhaar_path: str,
    selfie_path: str,
    minio_client,
    insightface_app,   # kept for API compatibility — unused, DeepFace is self-contained
    qdrant_service,
    user_id: str,
    app_id: str,
) -> FaceMatchResult:
    """
    Compare Aadhaar face vs selfie using DeepFace SFace embeddings.

    Thresholds (cosine similarity, higher = more similar):
      >= face_match_threshold (0.85)      → verified
      >= face_match_manual_review (0.70)  → manual_review
      < 0.70                              → failed
    """
    tmp_aadhaar: Optional[str] = None
    tmp_selfie: Optional[str] = None

    try:
        settings = get_settings()

        # 1. Fetch both images from MinIO in parallel
        aadhaar_bytes, selfie_bytes = await asyncio.gather(
            minio_client.fetch_file(aadhaar_path),
            minio_client.fetch_file(selfie_path),
        )

        # 2. Quick face detection sanity check (OpenCV Haar cascade — no extra deps)
        aadhaar_bgr, selfie_bgr = await asyncio.gather(
            asyncio.to_thread(_bytes_to_bgr, aadhaar_bytes),
            asyncio.to_thread(_bytes_to_bgr, selfie_bytes),
        )

        aadhaar_has_face = await asyncio.to_thread(_detect_face_opencv, aadhaar_bgr)
        selfie_has_face = await asyncio.to_thread(_detect_face_opencv, selfie_bgr)

        if not aadhaar_has_face or not selfie_has_face:
            missing = []
            if not aadhaar_has_face:
                missing.append("Aadhaar")
            if not selfie_has_face:
                missing.append("selfie")
            logger.warning("[FaceMatch] No face detected in: %s", ", ".join(missing))
            return FaceMatchResult(
                face_match_score=0.0,
                face_match_pass=False,
                flag="no_face_detected",
                message=f"No face detected in: {', '.join(missing)}. Please upload a clear front-facing photo.",
            )

        # 3. Write to temp files for DeepFace (needs file paths)
        tmp_aadhaar = await asyncio.to_thread(_save_temp_image, aadhaar_bytes, ".jpg")
        tmp_selfie = await asyncio.to_thread(_save_temp_image, selfie_bytes, ".jpg")

        # 4. Run DeepFace verification (downloads SFace ~37MB on first run)
        logger.info("[FaceMatch] Running DeepFace SFace comparison for user=%s", user_id)
        match_result = await asyncio.to_thread(
            _deepface_verify,
            tmp_aadhaar,
            tmp_selfie,
            settings.face_match_threshold,
        )

        similarity = match_result["similarity"]
        logger.info(
            "[FaceMatch] user=%s similarity=%.4f verified=%s",
            user_id, similarity, match_result["verified"],
        )

        # 5. Classify result
        if similarity >= settings.face_match_threshold:
            flag = "passed"
            face_match_pass = True
        elif similarity >= settings.face_match_manual_review_threshold:
            flag = "manual_review"
            face_match_pass = False
        else:
            flag = "failed"
            face_match_pass = False

        # 6. Store face embedding in Qdrant for duplicate detection
        # DeepFace SFace gives 128-dim embedding — store via represent()
        try:
            from deepface import DeepFace  # type: ignore
            import hashlib

            def _get_embedding(path: str) -> list:
                reps = DeepFace.represent(
                    img_path=path,
                    model_name="SFace",
                    detector_backend="opencv",
                    enforce_detection=False,
                    align=True,
                )
                return reps[0]["embedding"] if reps else []

            selfie_emb = await asyncio.to_thread(_get_embedding, tmp_selfie)
            if selfie_emb:
                uid_hash = hashlib.sha256(user_id.encode()).hexdigest()
                # Qdrant face_embeddings collection expects 512-dim (InsightFace default).
                # Pad SFace 128-dim to 512 by repeating (keeps cosine similarity valid).
                if len(selfie_emb) < 512:
                    repeat_times = 512 // len(selfie_emb) + 1
                    selfie_emb = (selfie_emb * repeat_times)[:512]
                await qdrant_service.upsert(
                    "face_embeddings",
                    uid_hash,
                    selfie_emb,
                    {"user_id": user_id, "app_id": app_id, "model": "deepface_sface"},
                )
        except Exception as emb_exc:
            logger.warning("[FaceMatch] Qdrant embedding store failed (non-fatal): %s", emb_exc)

        return FaceMatchResult(
            face_match_score=round(similarity, 4),
            face_match_pass=face_match_pass,
            flag=flag,
        )

    except Exception as exc:
        logger.error("[FaceMatch] Pipeline failed for user=%s: %s", user_id, exc)
        return FaceMatchResult(
            face_match_score=0.0,
            face_match_pass=False,
            flag="failed",
            message=str(exc),
        )
    finally:
        # Clean up temp files
        for tmp_path in [tmp_aadhaar, tmp_selfie]:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass


def init_insightface():
    """Stub kept for API compatibility — DeepFace needs no pre-initialization."""
    logger.info("[FaceMatch] Using DeepFace SFace backend (no pre-init needed)")
    return None
