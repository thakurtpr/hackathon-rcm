import json
import logging
from typing import Optional

import redis.asyncio as aioredis

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[aioredis.Redis] = None


def get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        settings = get_settings()
        _client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _client


async def get_json(key: str) -> Optional[dict]:
    try:
        raw = await get_client().get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Redis get_json(%s) failed: %s", key, exc)
        return None


async def set_json(key: str, value: dict, ttl: int) -> None:
    try:
        await get_client().setex(key, ttl, json.dumps(value))
    except Exception as exc:
        logger.warning("Redis set_json(%s) failed: %s", key, exc)


async def get_str(key: str) -> Optional[str]:
    try:
        return await get_client().get(key)
    except Exception as exc:
        logger.warning("Redis get_str(%s) failed: %s", key, exc)
        return None


async def set_str(key: str, value: str, ttl: int) -> None:
    try:
        await get_client().setex(key, ttl, value)
    except Exception as exc:
        logger.warning("Redis set_str(%s) failed: %s", key, exc)


async def delete(key: str) -> None:
    try:
        await get_client().delete(key)
    except Exception as exc:
        logger.warning("Redis delete(%s) failed: %s", key, exc)
