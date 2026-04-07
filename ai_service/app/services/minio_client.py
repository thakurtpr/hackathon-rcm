import asyncio
import io
import logging
import time
from typing import Optional

from minio import Minio
from minio.error import S3Error

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[Minio] = None


def _get_client() -> Minio:
    global _client
    if _client is None:
        settings = get_settings()
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=False,
        )
    return _client


def _sync_fetch(minio_path: str) -> bytes:
    settings = get_settings()
    client = _get_client()
    parts = minio_path.lstrip("/").split("/", 1)
    bucket = parts[0] if len(parts) > 1 else settings.minio_bucket
    key = parts[1] if len(parts) > 1 else minio_path
    response = client.get_object(bucket, key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


async def fetch_file(minio_path: str) -> bytes:
    last_exc: Exception = RuntimeError("Unknown error")
    for attempt in range(3):
        try:
            return await asyncio.to_thread(_sync_fetch, minio_path)
        except Exception as exc:
            last_exc = exc
            logger.warning("MinIO fetch attempt %d failed for %s: %s", attempt + 1, minio_path, exc)
            if attempt < 2:
                await asyncio.sleep(1)
    raise RuntimeError(f"Failed to fetch {minio_path} after 3 attempts: {last_exc}")


def _sync_ensure_bucket(bucket_name: str) -> None:
    client = _get_client()
    if not client.bucket_exists(bucket_name):
        client.make_bucket(bucket_name)


async def ensure_bucket(bucket_name: str) -> None:
    try:
        await asyncio.to_thread(_sync_ensure_bucket, bucket_name)
    except Exception as exc:
        logger.warning("MinIO ensure_bucket(%s) failed: %s", bucket_name, exc)


def _sync_upload(bucket: str, key: str, data: bytes, content_type: str) -> None:
    client = _get_client()
    client.put_object(bucket, key, io.BytesIO(data), len(data), content_type=content_type)


async def upload_bytes(bucket: str, key: str, data: bytes, content_type: str) -> None:
    try:
        await asyncio.to_thread(_sync_upload, bucket, key, data, content_type)
    except Exception as exc:
        logger.warning("MinIO upload_bytes(%s/%s) failed: %s", bucket, key, exc)
