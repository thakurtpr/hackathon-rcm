import json
import logging
import uuid
from datetime import datetime, timezone

from aiokafka import AIOKafkaProducer

from app.config import get_settings

logger = logging.getLogger(__name__)

_producer = None


async def get_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        settings = get_settings()
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_brokers,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )
        await _producer.start()
    return _producer


async def produce(topic: str, payload: dict) -> None:
    try:
        producer = await get_producer()
        event = {
            "event_id": str(uuid.uuid4()),
            "topic": topic,
            "app_id": payload.get("app_id", ""),
            "user_id": payload.get("user_id", ""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        await producer.send_and_wait(topic, event)
    except Exception as exc:
        logger.warning("Kafka produce to %s failed: %s", topic, exc)


async def close_producer() -> None:
    global _producer
    if _producer is not None:
        await _producer.stop()
        _producer = None
