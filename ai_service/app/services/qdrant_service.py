import asyncio
import logging
from typing import Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[QdrantClient] = None


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = QdrantClient(url=settings.qdrant_url)
    return _client


def _distance_enum(distance: str) -> Distance:
    mapping = {
        "Cosine": Distance.COSINE,
        "Euclid": Distance.EUCLID,
        "Dot": Distance.DOT,
    }
    return mapping.get(distance, Distance.COSINE)


def _sync_ensure_collection(name: str, vector_size: int, distance: str) -> None:
    client = _get_client()
    existing = [c.name for c in client.get_collections().collections]
    if name not in existing:
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=vector_size, distance=_distance_enum(distance)),
        )


async def ensure_collection(name: str, vector_size: int, distance: str) -> None:
    try:
        await asyncio.to_thread(_sync_ensure_collection, name, vector_size, distance)
    except Exception as exc:
        logger.warning("Qdrant ensure_collection(%s) failed: %s", name, exc)


def _sync_search(collection: str, vector: list, limit: int, score_threshold: float) -> list:
    client = _get_client()
    results = client.search(
        collection_name=collection,
        query_vector=vector,
        limit=limit,
        score_threshold=score_threshold if score_threshold > 0.0 else None,
    )
    return results


async def search(
    collection: str,
    vector: list,
    limit: int = 5,
    score_threshold: float = 0.0,
) -> list:
    try:
        return await asyncio.to_thread(_sync_search, collection, vector, limit, score_threshold)
    except Exception as exc:
        logger.warning("Qdrant search(%s) failed: %s", collection, exc)
        return []


def _sync_upsert(collection: str, id_: str, vector: list, payload: dict) -> None:
    import hashlib
    numeric_id = int(hashlib.md5(id_.encode()).hexdigest(), 16) % (2**63)
    client = _get_client()
    client.upsert(
        collection_name=collection,
        points=[PointStruct(id=numeric_id, vector=vector, payload={**payload, "_str_id": id_})],
    )


async def upsert(collection: str, id_: str, vector: list, payload: dict) -> None:
    try:
        await asyncio.to_thread(_sync_upsert, collection, id_, vector, payload)
    except Exception as exc:
        logger.warning("Qdrant upsert(%s, %s) failed: %s", collection, id_, exc)
