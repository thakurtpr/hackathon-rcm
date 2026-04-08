# ISSUE-003: AI Service Topic Initialization Race Condition

## Description
The AI Service (`hackforge-ai-service-1`) attempts to subscribe to Kafka topics immediately upon startup. However, if the Kafka broker is still initializing or if auto-creation is in progress, the subscription fails with a warning, potentially delaying message processing.

## Symptoms / Logs
```text
2026-04-08 00:11:12,750 [WARNING] aiokafka.cluster: Topic document.uploaded is not available during auto-create initialization
2026-04-08 00:11:12,750 [WARNING] aiokafka.cluster: Topic app.submitted is not available during auto-create initialization
```

## How to Replicate
1. Run `docker-compose down -v`.
2. Run `docker-compose up -d`.
3. Immediately check AI service logs: `docker logs hackforge-ai-service-1`.
4. Observe the `[WARNING]` logs from `aiokafka`.

## Acceptance Criteria
- [ ] AI Service implements a "Retry with Delay" mechanism for initial topic discovery.
- [ ] Startup logs confirm successful connection to all topics on the first try (or silent retry).
- [ ] No warnings from `aiokafka` regarding missing topics during initial boot.

---
> [!TIP]
> **Suggested Fix**: Adding a small `time.sleep()` before starting the Kafka consumer in the Python AI service, or ensuring topics are pre-created via a setup script.
