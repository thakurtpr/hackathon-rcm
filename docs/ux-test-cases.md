# UX Test Cases — Hackforge AI Student Loan System

## Current Test Status (automated)

```
Total: 106 tests
Passed: 104
Failed: 2  ←  xgboost not installed in venv (see Fix below)
```

### Failed Tests

| Test | File | Root Cause | Fix |
|------|------|-----------|-----|
| `test_load_model_creates_pkl` | `test_risk_model.py` | `xgboost` not installed in venv | `.venv/bin/pip install xgboost` |
| `test_load_model_loads_existing` | `test_risk_model.py` | same | same |

**Quick fix:**
```bash
cd ai_service
.venv/bin/pip install xgboost==2.0.3
.venv/bin/pytest tests/ -v
# Expected: 106/106 pass
```

---

## How to Run Everything

### 1. Start infrastructure + all services

```bash
# From repo root
docker compose up -d

# Wait ~60s for all health checks to pass, then verify:
docker compose ps
```

Expected: all containers `healthy` — postgres, redis, kafka, zookeeper, qdrant, minio, backend, ai-service, frontend.

### 2. Check service readiness

```bash
curl http://localhost:8001/health      # AI Service
curl http://localhost:8000/health      # Backend (Go)
open http://localhost:3000             # Frontend
```

### 3. Run unit tests (no Docker needed)

```bash
cd ai_service
.venv/bin/pytest tests/ -v --tb=short
```

---

## UX Test Cases — Manual Checklist

> Run these after `docker compose up` is fully healthy.
> Mark each as ✅ PASS, ❌ FAIL, or ⚠️ PARTIAL.

---

### TC-01: Health Check

**What to test:** Basic liveness of all services.

```bash
curl http://localhost:8001/health
curl http://localhost:8000/health
```

**Expected AI service response:**
```json
{"status": "ok", "models_loaded": true, "kafka_connected": true}
```

| Check | Expected | Status |
|-------|----------|--------|
| AI service returns 200 | `{"status":"ok"}` | |
| Backend returns 200 | `{"status":"ok"}` | |
| `models_loaded: true` in AI response | InsightFace + SentenceTransformer loaded | |
| Kafka consumer connected | `kafka_connected: true` | |

---

### TC-02: Document Upload → OCR Pipeline

**What to test:** Upload a document image → Kafka `doc.uploaded` event → OCR extracts fields → result POSTed back to backend.

**How:**
1. Log in or register via `http://localhost:3000`
2. Navigate to the application form
3. Upload an Aadhaar card image (any JPEG/PNG)

**Expected flow:**
1. Frontend sends file to backend → stored in MinIO
2. Backend emits `doc.uploaded` Kafka event
3. AI service picks it up, runs PaddleOCR
4. If Groq key set: LLM cleans/structures extracted text
5. Backend receives `/ai/kyc-result` POST

| Check | Expected | Status |
|-------|----------|--------|
| File appears in MinIO bucket `loan-docs` | visible at `http://localhost:9001` (minioadmin/minioadmin) | |
| Aadhaar fields extracted | `aadhaar_number`, `name`, `address`, `dob` present | |
| PAN fields extracted | `pan_number`, `name`, `dob` present | |
| `doc_authentic: true` when trust score ≥ 0.6 | check backend DB or API | |
| `doc_trust_score` between 0 and 1 | numeric value | |

**Docs supported:** `aadhaar`, `pan`, `marksheet`, `income_cert`, `bank_passbook`, `semester_marksheet`

---

### TC-03: Face Match / KYC

**What to test:** Upload both Aadhaar and selfie → face embeddings compared → result: `verified` / `manual_review` / `failed`.

**How:**
1. Upload Aadhaar (with face photo) first
2. Upload selfie second (or vice versa — order shouldn't matter)

**Expected flow:**
1. First upload sets path in Redis (`aadhaar_path:{user_id}` or `selfie_path:{user_id}`)
2. Second upload triggers face match
3. AI posts to `/ai/kyc-result` with `result` and `similarity`

| Check | Expected | Status |
|-------|----------|--------|
| Same person photo → `verified` | similarity ≥ 0.85 | |
| Slightly different angle → `manual_review` | 0.70 ≤ similarity < 0.85 | |
| Different person → `failed` | similarity < 0.70 | |
| If InsightFace unavailable | face match skipped gracefully, OCR still runs | |
| Result posted to backend `/ai/kyc-result` | `{"result":"verified","similarity":0.92,...}` | |

---

### TC-04: Behavioral PQ Quiz

**What to test:** Get questions for an application, submit answers, receive 202, score computed in background.

**How:**
```bash
# Get questions (app must have been submitted to trigger question generation)
curl "http://localhost:8001/behavioral/questions?app_id=demo-rajan-001"

# Submit answers
curl -X POST http://localhost:8001/behavioral/submit \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "demo-rajan-001",
    "answers": [
      {"question_id": "q1", "type": "mcq", "answer": "2", "time_taken": 15},
      {"question_id": "q2", "type": "mcq", "answer": "3", "time_taken": 20},
      {"question_id": "q3", "type": "mcq", "answer": "1", "time_taken": 18},
      {"question_id": "q4", "type": "mcq", "answer": "2", "time_taken": 12},
      {"question_id": "q5", "type": "mcq", "answer": "3", "time_taken": 25},
      {"question_id": "q6", "type": "mcq", "answer": "2", "time_taken": 10},
      {"question_id": "q7", "type": "mcq", "answer": "1", "time_taken": 30},
      {"question_id": "q8", "type": "mcq", "answer": "3", "time_taken": 22}
    ],
    "total_time": 152
  }'
```

| Check | Expected | Status |
|-------|----------|--------|
| GET `/behavioral/questions?app_id=...` returns 8 questions | `{"app_id":"...","questions":[...8 items...]}` | |
| GET with unknown app_id returns 404 | `{"detail":"Questions not generated yet..."}` | |
| POST `/behavioral/submit` returns 202 immediately | no body, HTTP 202 | |
| Score computed in background within ~5s | Redis key `behavioral_result:{app_id}` set | |
| PQ score between 0–100 | check via `redis-cli get behavioral_result:demo-rajan-001` | |
| Submission < 60s total → `suspiciously_fast` flag | time_flags contains "suspiciously_fast" | |
| `behavioral.scored` Kafka event emitted | check Kafka topic | |

---

### TC-05: Fraud Detection Pipeline

**What to test:** App submission triggers fraud checks in parallel.

**How:** Submit a loan application through the frontend (or emit `app.submitted` Kafka event directly).

```bash
# Directly emit Kafka event (requires kafka CLI tools):
docker exec -it hackforge-kafka-1 kafka-console-producer \
  --bootstrap-server localhost:9092 --topic app.submitted \
  --property "parse.key=false" <<'EOF'
{"event": "app.submitted", "payload": {"app_id": "test-app-001", "user_id": "test-user-001"}}
EOF
```

| Check | Expected | Status |
|-------|----------|--------|
| Duplicate PAN check runs | queries `/users/check-pan` on backend | |
| Duplicate Aadhaar check runs | queries `/users/check-aadhaar` on backend | |
| Face pool duplicate check | compares against stored embeddings in Qdrant | |
| Velocity check (>3 apps in 30 days) | queries `/users/{id}/app-count` | |
| Income inconsistency (OCR vs profile >40%) | `income_inconsistency` check result | |
| All 5 checks run in parallel | asyncio.gather (not sequential) | |
| Hard fraud flag: duplicate PAN/Aadhaar/face | `fraud_flag: true`, `fraud_reasons` list non-empty | |
| Result POSTed to backend `/ai/fraud-result` | backend fraud record updated | |
| `fraud.checked` Kafka event emitted | visible in topic | |

---

### TC-06: Scholarship Matching

**What to test:** After eligibility is determined, AI matches user profile to scholarships from the 20-entry `scholarships.json`.

**Trigger:** Kafka `eligibility.done` event.

| Check | Expected | Status |
|-------|----------|--------|
| Scholarships seeded into Qdrant at startup | 20 vectors in `scholarships` collection | |
| Profile income < scheme income_limit | only eligible schemes returned | |
| Category filter works | SC/ST/OBC applicants get relevant schemes | |
| Expired deadline filtered out | past-deadline schemes excluded | |
| `reason` field populated per scholarship | LLM-generated or fallback "Meets eligibility criteria" | |
| `total_value` sums matched amounts correctly | arithmetic correct | |
| Result POSTed to `/ai/scholarship-result` | backend receives JSON | |

**Verify Qdrant seeding:**
```bash
curl http://localhost:6333/collections/scholarships
# "vectors_count" should be 20
```

---

### TC-07: LangGraph Agent Orchestration

**What to test:** After eligibility, 5 agents run in sequence (or skip to final on fraud).

**Agents in order:**
1. `profile_agent` → summarizes profile
2. `doc_verification_agent` → doc verdict
3. `eligibility_eval_agent` → rationale
4. `policy_compliance_agent` → policy flags
5. `final_approval_agent` → decision + explanation + hints

| Check | Expected | Status |
|-------|----------|--------|
| All 5 agents produce output in `agent_state` | each agent updates only its own field | |
| `fraud_flag: true` skips directly to `final_approval_agent` | steps 2–4 skipped | |
| `final_approval_agent` returns ≤ 3 hints | `hints` list capped at 3 items | |
| Explanation result POSTed to backend | `/ai/explanation-result` call made | |
| PQ override applied (pq_score < 40) | `pq_override: true` in state | |

---

### TC-08: AI Chat (Multilingual)

**What to test:** RAG-powered chat about loan policies, in English, Hindi, and Odia.

```bash
# English
curl -X POST http://localhost:8001/chat/message \
  -H "Content-Type: application/json" \
  -d '{"user_id":"u1","message":"What is the interest rate for education loans?","language":"en"}'

# Hindi
curl -X POST http://localhost:8001/chat/message \
  -H "Content-Type: application/json" \
  -d '{"user_id":"u1","message":"शिक्षा ऋण के लिए ब्याज दर क्या है?","language":"hi"}'

# Odia
curl -X POST http://localhost:8001/chat/message \
  -H "Content-Type: application/json" \
  -d '{"user_id":"u1","message":"ଶିକ୍ଷା ଋଣ ସୁଧ ହାର କ'ଣ?","language":"od"}'
```

| Check | Expected | Status |
|-------|----------|--------|
| Returns `reply`, `sources`, `conversation_id` | response shape correct | |
| Follow-up message uses `conversation_id` | context maintained across turns | |
| Hindi query → Hindi response | response in Devanagari script | |
| Odia query → Odia response | response in Odia script | |
| `sources` populated when RAG finds relevant docs | loan policy doc names listed | |
| History capped at 10 messages in Redis | `chat:{conversation_id}` Redis key holds ≤10 messages | |
| Empty `loan_policies` collection → answers from LLM knowledge | still responds, sources=[] | |

**Seed loan policies for better RAG:**
```bash
cd ai_service && .venv/bin/python scripts/demo_seed.py
```

---

### TC-09: Risk Model (XGBoost)

**What to test:** Risk scoring endpoint / background model load.

| Check | Expected | Status |
|-------|----------|--------|
| XGBoost installed in venv | `.venv/bin/pip install xgboost==2.0.3` | ❌ Missing |
| `models_loaded` in `/health` reflects risk model | `risk_model_loaded: true` if xgboost present | |
| Rule-based fallback works without xgboost | low/medium/high risk still computed | ✅ |
| `test_load_model_creates_pkl` passes | after install | ❌ Currently failing |
| `test_load_model_loads_existing` passes | after install | ❌ Currently failing |

---

### TC-10: Full End-to-End Happy Path

**Complete flow from registration to approval:**

```
1. Register user → POST /auth/register
2. Create loan application → POST /applications
3. Upload documents (aadhaar, pan, selfie, income_cert, marksheet)
   → Each triggers doc.uploaded → OCR + face match
4. Application auto-submitted once all docs verified
   → Triggers app.submitted → fraud checks + behavioral questions
5. User completes behavioral quiz
   → POST /behavioral/submit → 202 → score computed
6. Backend computes composite score, emits eligibility.done
   → Scholarship matching + agent orchestration run in parallel
7. Final decision returned to frontend
8. User chats with AI about their result/scholarships
```

| Step | Check | Expected | Status |
|------|-------|----------|--------|
| 1 | User registers + JWT issued | 200 with token | |
| 2 | Application created | app_id returned | |
| 3a | Aadhaar uploaded + OCR runs | `aadhaar_number` extracted | |
| 3b | PAN uploaded + OCR runs | `pan_number` extracted | |
| 3c | Selfie + Aadhaar triggers face match | `verified`/`manual_review` | |
| 4a | `app.submitted` event triggers fraud checks | `fraud_flag` set in backend | |
| 4b | Behavioral questions generated in Redis | GET `/behavioral/questions` returns 8 | |
| 5 | Answers submitted → 202 | PQ score stored in Redis | |
| 6a | Scholarships matched | ≥1 scheme returned for eligible profile | |
| 6b | All 5 agents complete | explanation stored in backend | |
| 7 | Decision visible in frontend | approved/review/rejected shown | |
| 8 | Chat responds about loan terms | relevant sources cited | |

---

## Known Issues / Not Working

| # | Component | Issue | Severity |
|---|-----------|-------|----------|
| 1 | Risk Model | `xgboost` not installed in venv → 2 test failures | Medium — fallback works |
| 2 | InsightFace | Requires ~400MB model download (`buffalo_l`) on first startup — slow cold start | Medium |
| 3 | PaddleOCR | Requires `paddlepaddle` which fails on ARM Mac (M1/M2/M3) without Rosetta | High on Mac |
| 4 | LLM (Groq) | Default key `gsk_xxxx` is a placeholder — chat/behavioral scoring will return empty strings without valid key | High |
| 5 | Chat RAG | `loan_policies` Qdrant collection starts empty — `demo_seed.py` must be run manually | Medium |
| 6 | Kafka consumer | If Kafka is unavailable, `app.submitted`/`doc.uploaded` events are silently dropped | High |
| 7 | Face match on Mac | `onnxruntime` CPU provider may need `onnxruntime-silicon` on Apple Silicon | Medium |
| 8 | Frontend build | `package-lock.json` unstaged — `npm ci` may fail if lockfile doesn't match `package.json` | Low |

---

## Environment Setup Checklist

Before testing, verify these env vars are set in `.env` at repo root:

```bash
GROQ_API_KEY=gsk_your_real_key_here   # Required for LLM features
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=hackforge
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

Check if `.env` exists:
```bash
ls /Users/thakur/thakur-dev/hackforge/.env
```

If missing, copy from template if one exists, or create it with the values above.

---

## Quick Smoke Test Script

Run this after `docker compose up` is healthy:

```bash
#!/bin/bash
BASE_AI="http://localhost:8001"
BASE_BE="http://localhost:8000"

echo "=== Health ===" 
curl -s $BASE_AI/health | python3 -m json.tool

echo "=== Behavioral Questions (expect 404 for unknown app) ==="
curl -s "$BASE_AI/behavioral/questions?app_id=nonexistent" | python3 -m json.tool

echo "=== Chat (English) ==="
curl -s -X POST $BASE_AI/chat/message \
  -H "Content-Type: application/json" \
  -d '{"user_id":"smoke-test","message":"What documents are needed for education loan?","language":"en"}' \
  | python3 -m json.tool

echo "=== Fraud check proxy (PAN) ==="
curl -s "$BASE_AI/users/check-pan?pan=abc123" | python3 -m json.tool

echo "Done."
```

Save as `scripts/smoke_test.sh`, then:
```bash
chmod +x scripts/smoke_test.sh && bash scripts/smoke_test.sh
```
