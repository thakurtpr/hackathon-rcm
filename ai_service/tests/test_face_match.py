import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _make_face_with_score(score: float):
    """Create mock InsightFace face objects that produce the given cosine similarity."""
    emb_a = np.ones(512, dtype=np.float32)
    emb_a = emb_a / np.linalg.norm(emb_a)

    emb_b = emb_a.copy()
    if score < 1.0:
        perp = np.zeros(512, dtype=np.float32)
        perp[1] = 1.0
        perp = perp - np.dot(perp, emb_a) * emb_a
        perp = perp / np.linalg.norm(perp)
        angle = np.arccos(np.clip(score, -1.0, 1.0))
        emb_b = emb_a * np.cos(angle) + perp * np.sin(angle)

    face_a = MagicMock()
    face_a.embedding = emb_a * np.linalg.norm(emb_a)

    face_b = MagicMock()
    face_b.embedding = emb_b * np.linalg.norm(emb_a)

    return [face_a], [face_b]


def test_threshold_passed():
    from app.models.responses import FaceMatchResult
    score = 0.90
    faces_a, faces_b = _make_face_with_score(score)

    emb_a = faces_a[0].embedding.astype(np.float32)
    emb_a = emb_a / (np.linalg.norm(emb_a) + 1e-8)
    emb_b = faces_b[0].embedding.astype(np.float32)
    emb_b = emb_b / (np.linalg.norm(emb_b) + 1e-8)
    computed_score = float(np.dot(emb_a, emb_b))

    assert computed_score >= 0.85
    result = FaceMatchResult(face_match_score=round(computed_score, 4), face_match_pass=True, flag="passed")
    assert result.flag == "passed"
    assert result.face_match_pass is True


def test_threshold_manual_review():
    from app.models.responses import FaceMatchResult
    score = 0.77
    faces_a, faces_b = _make_face_with_score(score)

    emb_a = faces_a[0].embedding.astype(np.float32)
    emb_a = emb_a / (np.linalg.norm(emb_a) + 1e-8)
    emb_b = faces_b[0].embedding.astype(np.float32)
    emb_b = emb_b / (np.linalg.norm(emb_b) + 1e-8)
    computed_score = float(np.dot(emb_a, emb_b))

    assert 0.70 <= computed_score < 0.85
    result = FaceMatchResult(face_match_score=round(computed_score, 4), face_match_pass=False, flag="manual_review")
    assert result.flag == "manual_review"
    assert result.face_match_pass is False


def test_threshold_failed():
    from app.models.responses import FaceMatchResult
    score = 0.65
    faces_a, faces_b = _make_face_with_score(score)

    emb_a = faces_a[0].embedding.astype(np.float32)
    emb_a = emb_a / (np.linalg.norm(emb_a) + 1e-8)
    emb_b = faces_b[0].embedding.astype(np.float32)
    emb_b = emb_b / (np.linalg.norm(emb_b) + 1e-8)
    computed_score = float(np.dot(emb_a, emb_b))

    assert computed_score < 0.70
    result = FaceMatchResult(face_match_score=round(computed_score, 4), face_match_pass=False, flag="failed")
    assert result.flag == "failed"
    assert result.face_match_pass is False


@pytest.mark.asyncio
async def test_no_face_detected():
    from app.pipelines.face_match_pipeline import run
    from app.models.responses import FaceMatchResult

    mock_minio = AsyncMock()
    mock_minio.fetch_file = AsyncMock(return_value=b"fake_image_data")

    mock_insightface = MagicMock()
    mock_insightface.get = MagicMock(return_value=[])

    mock_qdrant = AsyncMock()

    with patch("app.pipelines.face_match_pipeline.Image") as mock_pil, \
         patch("app.pipelines.face_match_pipeline.cv2") as mock_cv2, \
         patch("app.pipelines.face_match_pipeline.np") as mock_np:

        mock_pil.open.return_value.__enter__ = lambda s: s
        mock_pil.open.return_value.__exit__ = MagicMock(return_value=False)
        mock_pil.open.return_value.convert.return_value = MagicMock()

        mock_np.array.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
        mock_cv2.cvtColor.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
        mock_cv2.COLOR_RGB2BGR = 4

        result = await run(
            aadhaar_path="bucket/aadhaar.jpg",
            selfie_path="bucket/selfie.jpg",
            minio_client=mock_minio,
            insightface_app=mock_insightface,
            qdrant_service=mock_qdrant,
            user_id="user-test",
            app_id="app-test",
        )

    assert result.flag == "no_face_detected"
    assert result.face_match_pass is False
    assert result.face_match_score == 0.0
