import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_embeddings(target_similarity: float):
    """
    Return (emb_a, emb_b) unit vectors with the given cosine similarity.
    Both are 512-d float32 vectors.
    """
    emb_a = np.ones(512, dtype=np.float32)
    emb_a = emb_a / np.linalg.norm(emb_a)

    if target_similarity >= 1.0:
        emb_b = emb_a.copy()
    else:
        # Build a perpendicular component
        perp = np.zeros(512, dtype=np.float32)
        perp[1] = 1.0
        perp = perp - np.dot(perp, emb_a) * emb_a
        perp = perp / np.linalg.norm(perp)
        angle = np.arccos(np.clip(target_similarity, -1.0, 1.0))
        emb_b = emb_a * np.cos(angle) + perp * np.sin(angle)

    return emb_a, emb_b


# ---------------------------------------------------------------------------
# cosine_similarity tests
# ---------------------------------------------------------------------------

def test_cosine_similarity_identical():
    from app.pipelines.face_match_pipeline import cosine_similarity
    emb = np.ones(512, dtype=np.float32)
    score = cosine_similarity(emb, emb)
    assert abs(score - 1.0) < 1e-5


def test_cosine_similarity_orthogonal():
    from app.pipelines.face_match_pipeline import cosine_similarity
    emb_a = np.zeros(512, dtype=np.float32)
    emb_b = np.zeros(512, dtype=np.float32)
    emb_a[0] = 1.0
    emb_b[1] = 1.0
    score = cosine_similarity(emb_a, emb_b)
    assert abs(score) < 1e-5


def test_cosine_similarity_target_value():
    from app.pipelines.face_match_pipeline import cosine_similarity
    emb_a, emb_b = _make_embeddings(0.91)
    score = cosine_similarity(emb_a, emb_b)
    assert abs(score - 0.91) < 0.001


def test_cosine_similarity_low():
    from app.pipelines.face_match_pipeline import cosine_similarity
    emb_a, emb_b = _make_embeddings(0.60)
    score = cosine_similarity(emb_a, emb_b)
    assert abs(score - 0.60) < 0.001


# ---------------------------------------------------------------------------
# match_faces threshold boundary tests (mocked get_embedding)
# ---------------------------------------------------------------------------

def test_match_faces_verified(monkeypatch):
    """similarity >= 0.85 => result 'verified'"""
    from app.pipelines import face_match_pipeline

    emb_a, emb_b = _make_embeddings(0.91)
    monkeypatch.setattr(face_match_pipeline, "_insightface_app", MagicMock())

    with patch.object(face_match_pipeline, "get_embedding", side_effect=[emb_a, emb_b]):
        result = face_match_pipeline.match_faces("aadhaar.jpg", "selfie.jpg")

    assert result["result"] == "verified"
    assert result["similarity"] >= 0.85


def test_match_faces_manual_review(monkeypatch):
    """0.70 <= similarity < 0.85 => result 'manual_review'"""
    from app.pipelines import face_match_pipeline

    emb_a, emb_b = _make_embeddings(0.77)
    monkeypatch.setattr(face_match_pipeline, "_insightface_app", MagicMock())

    with patch.object(face_match_pipeline, "get_embedding", side_effect=[emb_a, emb_b]):
        result = face_match_pipeline.match_faces("aadhaar.jpg", "selfie.jpg")

    assert result["result"] == "manual_review"
    assert 0.70 <= result["similarity"] < 0.85


def test_match_faces_failed(monkeypatch):
    """similarity < 0.70 => result 'failed'"""
    from app.pipelines import face_match_pipeline

    emb_a, emb_b = _make_embeddings(0.60)
    monkeypatch.setattr(face_match_pipeline, "_insightface_app", MagicMock())

    with patch.object(face_match_pipeline, "get_embedding", side_effect=[emb_a, emb_b]):
        result = face_match_pipeline.match_faces("aadhaar.jpg", "selfie.jpg")

    assert result["result"] == "failed"
    assert result["similarity"] < 0.70


def test_match_faces_exact_verified_boundary(monkeypatch):
    """similarity == 0.85 => 'verified' (inclusive lower bound)"""
    from app.pipelines import face_match_pipeline

    emb_a, emb_b = _make_embeddings(0.85)
    monkeypatch.setattr(face_match_pipeline, "_insightface_app", MagicMock())

    with patch.object(face_match_pipeline, "get_embedding", side_effect=[emb_a, emb_b]):
        result = face_match_pipeline.match_faces("aadhaar.jpg", "selfie.jpg")

    assert result["result"] == "verified"


def test_match_faces_exact_manual_review_boundary(monkeypatch):
    """similarity just above 0.70 => 'manual_review' (inclusive lower bound)"""
    from app.pipelines import face_match_pipeline

    # Use 0.71 to avoid floating-point rounding below the 0.70 threshold
    emb_a, emb_b = _make_embeddings(0.71)
    monkeypatch.setattr(face_match_pipeline, "_insightface_app", MagicMock())

    with patch.object(face_match_pipeline, "get_embedding", side_effect=[emb_a, emb_b]):
        result = face_match_pipeline.match_faces("aadhaar.jpg", "selfie.jpg")

    assert result["result"] == "manual_review"


def test_match_faces_returns_required_keys(monkeypatch):
    """match_faces result always contains 'result' and 'similarity' keys."""
    from app.pipelines import face_match_pipeline

    emb_a, emb_b = _make_embeddings(0.80)
    monkeypatch.setattr(face_match_pipeline, "_insightface_app", MagicMock())

    with patch.object(face_match_pipeline, "get_embedding", side_effect=[emb_a, emb_b]):
        result = face_match_pipeline.match_faces("aadhaar.jpg", "selfie.jpg")

    assert "result" in result
    assert "similarity" in result
    assert result["result"] in ("verified", "manual_review", "failed")


# ---------------------------------------------------------------------------
# FaceMatchResult model tests (matching the run() pipeline output)
# ---------------------------------------------------------------------------

def test_face_match_result_passed():
    from app.models.responses import FaceMatchResult
    r = FaceMatchResult(face_match_score=0.91, face_match_pass=True, flag="passed")
    assert r.flag == "passed"
    assert r.face_match_pass is True


def test_face_match_result_manual_review():
    from app.models.responses import FaceMatchResult
    r = FaceMatchResult(face_match_score=0.77, face_match_pass=False, flag="manual_review")
    assert r.flag == "manual_review"
    assert r.face_match_pass is False


def test_face_match_result_failed():
    from app.models.responses import FaceMatchResult
    r = FaceMatchResult(face_match_score=0.60, face_match_pass=False, flag="failed")
    assert r.flag == "failed"
    assert r.face_match_pass is False


# ---------------------------------------------------------------------------
# run() pipeline: no face detected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_no_face_detected():
    """When InsightFace finds no faces, run() returns no_face_detected."""
    from app.pipelines.face_match_pipeline import run

    mock_minio = AsyncMock()
    mock_minio.fetch_file = AsyncMock(return_value=b"\xff\xd8\xff" + b"\x00" * 100)

    mock_insightface = MagicMock()
    # .get() returns empty list — no face detected
    mock_insightface.get = MagicMock(return_value=[])

    mock_qdrant = AsyncMock()

    with patch("app.pipelines.face_match_pipeline.Image") as mock_pil, \
         patch("app.pipelines.face_match_pipeline.cv2") as mock_cv2:

        mock_pil.open.return_value.convert.return_value = MagicMock()
        mock_cv2.cvtColor.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
        mock_cv2.COLOR_RGB2BGR = 4

        result = await run(
            aadhaar_path="bucket/aadhaar.jpg",
            selfie_path="bucket/selfie.jpg",
            minio_client=mock_minio,
            insightface_app=mock_insightface,
            qdrant_service=mock_qdrant,
            user_id="user-001",
            app_id="app-001",
        )

    assert result.flag == "no_face_detected"
    assert result.face_match_pass is False
    assert result.face_match_score == 0.0


@pytest.mark.asyncio
async def test_run_face_verified():
    """run() correctly flags 'passed' when similarity >= 0.85."""
    from app.pipelines.face_match_pipeline import run

    emb_a, emb_b = _make_embeddings(0.91)

    # Scale embeddings as InsightFace would return them (non-normalised)
    face_a = MagicMock()
    face_a.embedding = emb_a * 10.0  # unnormalised

    face_b = MagicMock()
    face_b.embedding = emb_b * 10.0

    mock_minio = AsyncMock()
    mock_minio.fetch_file = AsyncMock(return_value=b"\xff\xd8\xff" + b"\x00" * 100)

    mock_insightface = MagicMock()
    mock_insightface.get = MagicMock(side_effect=[[face_a], [face_b]])

    mock_qdrant = AsyncMock()
    mock_qdrant.upsert = AsyncMock()

    with patch("app.pipelines.face_match_pipeline.Image") as mock_pil, \
         patch("app.pipelines.face_match_pipeline.cv2") as mock_cv2:

        mock_pil.open.return_value.convert.return_value = MagicMock()
        mock_cv2.cvtColor.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
        mock_cv2.COLOR_RGB2BGR = 4

        result = await run(
            aadhaar_path="bucket/aadhaar.jpg",
            selfie_path="bucket/selfie.jpg",
            minio_client=mock_minio,
            insightface_app=mock_insightface,
            qdrant_service=mock_qdrant,
            user_id="user-001",
            app_id="app-001",
        )

    assert result.flag == "passed"
    assert result.face_match_pass is True
    assert result.face_match_score >= 0.85
