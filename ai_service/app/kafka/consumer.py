import asyncio
import json
import logging

from aiokafka import AIOKafkaConsumer

from app.config import get_settings
from app.kafka import handlers

logger = logging.getLogger(__name__)

TOPICS = ["document.uploaded", "app.submitted", "eligibility.calculated"]

TOPIC_HANDLERS = {
    "document.uploaded": handlers.handle_doc_uploaded,
    "app.submitted": handlers.handle_app_submitted,
    "eligibility.calculated": handlers.handle_eligibility_done,
}


async def _safe_handle(topic: str, handler, event: dict) -> None:
    try:
        await handler(event)
    except Exception as exc:
        logger.error("Error processing Kafka message from %s: %s", topic, exc)


async def start_kafka_consumer(app) -> None:
    settings = get_settings()
    consumer = None

    for attempt in range(5):
        try:
            consumer = AIOKafkaConsumer(
                *TOPICS,
                bootstrap_servers=settings.kafka_brokers,
                group_id=settings.kafka_group_id,
                auto_offset_reset="earliest",
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                # Raise session timeout above default 10s — handlers call LLM (10-300s).
                # Heartbeat task is asyncio-based so it needs the event loop to be free;
                # messages are dispatched as background tasks (see below) to ensure that.
                session_timeout_ms=60000,
                heartbeat_interval_ms=10000,
                # Allow up to 10 min between polls to handle slow LLM pipelines.
                max_poll_interval_ms=600000,
                request_timeout_ms=70000,
            )
            await consumer.start()
            logger.info("Kafka consumer connected on attempt %d", attempt + 1)
            break
        except Exception as exc:
            logger.warning("Kafka connection attempt %d failed: %s", attempt + 1, exc)
            consumer = None
            if attempt < 4:
                await asyncio.sleep(10 * (attempt + 1))

    if consumer is None:
        logger.error("Kafka consumer could not connect after 5 attempts — running without Kafka")
        return

    try:
        async for msg in consumer:
            handler = TOPIC_HANDLERS.get(msg.topic)
            if handler:
                # Dispatch as a background task so the consumer loop continues
                # polling and sending heartbeats while handlers run (including
                # slow LLM calls that would otherwise block the event loop).
                asyncio.create_task(_safe_handle(msg.topic, handler, msg.value))
            else:
                logger.warning("No handler for topic: %s", msg.topic)
    finally:
        await consumer.stop()
