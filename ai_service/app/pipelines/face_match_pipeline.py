import asyncio
import hashlib
import logging

import cv2
import numpy as np
from PIL import Image
from io import BytesIO

from app.models.responses import FaceMatchResult
from app.config import get_settings

logger = logging.getLogger(__name__)


async def run(
    aadhaar_path: str,
    selfie_path: str,
    minio_client,
    insightface_app,
    qdrant_service,
    user_id: str,
    app_id: str,
) -> FaceMatchResult:
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
