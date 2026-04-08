# ISSUE-002: Stale Backend Deployment (Unverified Fast2SMS Route)

## Description
The backend container is running an outdated version of the code that still attempts to use **Fast2SMS** for OTP delivery. This results in delivery failures because the Fast2SMS account requires website verification. 

A migration to **SMTP Email** has been implemented in the source code, but the running container has not been updated.

## Symptoms / Logs
```text
2026/04/08 00:13:15 ║  OTP for 7684858506: 690445  ║
2026/04/08 00:13:16 [SMS] ACTION NEEDED: Go to fast2sms.com → OTP Message → complete website verification.
```

## How to Replicate
1. Trigger a Sign-up or Login event from the frontend.
2. Check the backend logs: `docker logs hackforge-backend-1`.
3. Observe the `[SMS] ACTION NEEDED` warning and the lack of `[EMAIL] Sent successfully` logs.

## Acceptance Criteria
- [ ] Backend container rebuilt with latest SMTP changes.
- [ ] OTP requests trigger `EMAIL OTP` logs.
- [ ] No further attempts to call Fast2SMS API (`sms.go` removed).

---
> [!IMPORTANT]
> **Resolution**: Run `docker-compose up -d --build backend` to apply the latest code changes.
