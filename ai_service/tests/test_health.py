"""Tests for health endpoint."""
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture
def client():
    with patch("app.services.qdrant_service.search", new_callable=AsyncMock) as mock_qdrant, \
         patch("app.services.minio_client.ensure_bucket", new_callable=AsyncMock), \
         patch("app.kafka.consumer.start_kafka_consumer", new_callable=AsyncMock), \
         patch("app.services.risk_model.load_model", return_value=True):
        mock_qdrant.return_value = []
        from app.main import app
        # Manually set app state for testing
        app.state.models_loaded = True
        app.state.risk_model_loaded = True
        app.state.kafka_task = MagicMock()
        app.state.kafka_task.done = MagicMock(return_value=False)
        yield TestClient(app)


def test_health_endpoint_returns_200(client):
    with patch("app.routers.health.qdrant_service.search", new_callable=AsyncMock) as mock_qdrant:
        mock_qdrant.return_value = []
        resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "models_loaded" in data
    assert "kafka_connected" in data
    assert "qdrant_connected" in data


def test_health_response_has_all_fields(client):
    with patch("app.routers.health.qdrant_service.search", new_callable=AsyncMock) as mock_qdrant:
        mock_qdrant.return_value = []
        resp = client.get("/health")
    data = resp.json()
    required_fields = ["status", "models_loaded", "kafka_connected", "qdrant_connected", "llm_provider"]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"
