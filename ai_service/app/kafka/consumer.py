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


async def start_kafka_consumer(app) -> None:
    settings = get_settings()
    consumer = None

    for attempt in range(3):
        try:
            consumer = AIOKafkaConsumer(
                *TOPICS,
                bootstrap_servers=settings.kafka_brokers,
                group_id=settings.kafka_group_id,
                auto_offset_reset="earliest",
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            )
            await consumer.start()
            logger.info("Kafka consumer connected on attempt %d", attempt + 1)
            break
        except Exception as exc:
            logger.warning("Kafka connection attempt %d failed: %s", attempt + 1, exc)
            consumer = None
            if attempt < 2:
                await asyncio.sleep(5)

    if consumer is None:
        logger.error("Kafka consumer could not connect after 3 attempts — running without Kafka")
        return

    try:
        async for msg in consumer:
            try:
                topic = msg.topic
                event = msg.value
                handler = TOPIC_HANDLERS.get(topic)
                if handler:
                    await handler(event)
                else:
                    logger.warning("No handler for topic: %s", topic)
            except Exception as exc:
                logger.error("Error processing Kafka message from %s: %s", msg.topic, exc)
    finally:
        await consumer.stop()
