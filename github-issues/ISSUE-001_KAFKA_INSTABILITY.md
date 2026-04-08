# ISSUE-001: Kafka Consumer Group Instability (Rebalancing Loop)

## Description
The backend service (`hackforge-backend-1`) is experiencing persistent Kafka consumer group rebalances. This causes significant latency in processing critical events like KYC completion, scholarship matching, and behavioral scoring.

## Symptoms / Logs
```text
2026/04/08 00:08:31 [KAFKA] fetch error (explanation.ready): [27] Rebalance In Progress
2026/04/08 00:08:31 [KAFKA] fetch error (kyc.completed): [27] Rebalance In Progress
2026/04/08 00:08:31 [KAFKA] fetch error (fraud.checked): [5] Leader Not Available
```

## How to Replicate
1. Start the HackForge infrastructure via `docker-compose up -d`.
2. Observe backend logs using `docker logs -f hackforge-backend-1`.
3. Wait for the initial connection phase (approx 30s-1min).
4. Note the recurring `Rebalance In Progress` messages every 15-30 seconds.

## Acceptance Criteria
- [ ] Backend logs show `[KAFKA] connected` for all topics.
- [ ] No `Rebalance In Progress` errors for at least 5 minutes of idle operation.
- [ ] Messages published to `app.submitted` are immediately picked up by the AI service.

---
> [!NOTE]
> This may be caused by `session.timeout.ms` being too low or a mismatch in the number of partitions vs consumers.
