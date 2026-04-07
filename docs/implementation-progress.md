# Implementation Progress Report
**Project:** AI-Enabled Student Loan Eligibility, Application, Disbursal & Agentic Scholarship Approval System
**Sponsor:** SPARC — Igniting Innovations
**Date:** 2026-04-07
**Branches Audited:** `main` (Person C), `stage` (Person B), `amit` (Person A)

---

## Overall System Completion

| Layer | Person | Branch | Stack | Overall % |
|-------|--------|--------|-------|-----------|
| AI / LLM Service | Person C | `main` | Python + FastAPI + LangGraph + Groq | **85%** |
| Backend API | Person B | `stage` | Go + Gin + PostgreSQL + Kafka | **60%** |
| Frontend UI | Person A | `amit` | Next.js 14 + TypeScript + Tailwind + Zustand | **72%** |
| **End-to-End System** | All | All | — | **~70%** |

---

## Person C — AI/LLM Service (Branch: `main`)

### Feature Coverage

| Feature / Module | Requirement | Status | % Done | Notes |
|---|---|---|---|---|
| FastAPI app entry point | `app/main.py` with lifespan | ✅ Done | 100% | InsightFace, Qdrant seeding, Kafka consumer wired |
| **Pipeline 1 — OCR** | PaddleOCR + LayoutLM + doc_trust_score | ✅ Done | 85% | Uses Groq for structuring instead of LayoutLM (acceptable workaround); all 6 doc types handled |
| **Pipeline 2 — Face Match** | InsightFace 512-dim embedding, cosine similarity, 3-tier threshold | ✅ Done | 90% | Thresholds (≥0.85 pass, 0.70–0.84 manual, <0.70 fail) implemented correctly |
| **Pipeline 3 — Fraud Detection** | Duplicate PAN hash, Aadhaar hash, face pool Qdrant check | ✅ Done | 85% | All 3 checks implemented; doc metadata tamper check partial |
| **Pipeline 4 — Behavioral PQ Engine** | 8 questions (3 MCQ situational, 2 MCQ finlit, 2 free-text, 1 free-text initiative), 6-dimension scoring | ✅ Done | 85% | Question generation prompt + Groq scoring implemented; mcq_rubric.json present |
| **Pipeline 5 — Scholarship Matcher** | Qdrant RAG, embed profile, top-5, filter by category/income/state/gender/deadline | ✅ Done | 80% | Full filter logic in `scholarship_pipeline.py`; seed data (scholarships.json) present |
| **LangGraph Orchestrator** | 5 agents: profile, doc_verification, eligibility_eval, policy_compliance, final_approval | ✅ Done | 85% | All 5 agent files exist; StateGraph wired with routing logic |
| **Kafka Consumer** | 3 topics: `document.uploaded`, `app.submitted`, `eligibility.calculated` | ✅ Done | 90% | aiokafka with retry (3 attempts), group_id `ai-svc`; all 3 handlers present |
| **Kafka Producer** | Fires `behavioral.scored` | ✅ Done | 90% | Producer implemented |
| **GET /behavioral/questions** | Returns cached questions from Redis | ✅ Done | 90% | Redis cache key `questions:{app_id}` |
| **POST /behavioral/submit** | Scores answers async, posts to Person B | ✅ Done | 90% | Posts to `/ai/behavioral-result`, fires Kafka event |
| **POST /chat/message** | RAG chatbot, multi-turn, 3 languages | ✅ Done | 80% | Qdrant RAG over loan policy docs; Hindi/Odia/English routing present |
| **Backend Client** | POST to `/ai/kyc-result`, `/ai/behavioral-result`, `/ai/fraud-result`, `/ai/scholarship-result`, `/ai/explanation-result` | ✅ Done | 85% | All 5 POST endpoints to Person B implemented |
| Redis Service | Session/question cache | ✅ Done | 85% | `get_json` / `set_json` with TTL |
| Qdrant Service | Vector upsert + search | ✅ Done | 85% | `scholarships` + `face_embeddings` collections |
| MinIO Client | File fetch for docs | ✅ Done | 85% | `fetch_file(minio_path)` implemented |
| Pydantic Models | Request/response schemas | ✅ Done | 95% | `requests.py` + `responses.py` fully typed |
| Prompts | `question_generation.py`, `answer_scoring.py`, `explanation.py`, `mcq_rubric.json` | ✅ Done | 95% | All prompt templates separated from code |
| Tests | `test_behavioral`, `test_face_match`, `test_fraud`, `test_ocr` | ⚠️ Partial | 60% | 4 files present; coverage is partial, edge cases missing |
| XGBoost Risk Model | Mentioned in requirements.txt | ⚠️ Partial | 30% | Package in requirements.txt but not clearly used in scoring pipeline |
| LayoutLM | Structured doc parsing | ⚠️ Partial | 20% | Groq used as substitute; LayoutLM not directly called |
| Seed Scripts | `seed_qdrant.py`, `demo_seed.py` | ✅ Done | 100% | Both scripts present |
| `.env.example` | Config template | ✅ Done | 100% | Present |

### What's Missing (Person C)
- LayoutLM direct integration (currently replaced by Groq prompting)
- XGBoost scoring pipeline not clearly wired into eligibility flow
- Test coverage low — edge cases for fraud, OCR failure modes not covered
- No explicit `/health` detailed checks for all dependencies (partial)

---

## Person B — Backend API (Branch: `stage`)

### Feature Coverage

| Feature / Module | Requirement | Status | % Done | Notes |
|---|---|---|---|---|
| **Module 1 — Auth** | POST /auth/register, verify-otp, login, refresh, DigiLocker init/callback | ✅ Done | 75% | Register/OTP/Login fully implemented with JWT + bcrypt; refresh/DigiLocker are stubs |
| **Module 2 — User & Profile** | PUT /users/:id/profile (upsert all fields), GET /users/:id/profile | ⚠️ Partial | 55% | Endpoints exist; PUT only sets `kyc_status`, full field upsert not implemented |
| **Module 2 — Dedup Checks** | GET /users/check-pan, GET /users/check-aadhaar | ❌ Missing | 0% | Person C calls these; not implemented in B |
| **Module 3 — Documents** | POST /documents/upload (MinIO + Kafka), GET /documents/:id/status | ⚠️ Partial | 65% | Upload fires Kafka `document.uploaded` ✅; MinIO not integrated; status returns empty |
| **Module 4 — Applications** | POST /applications, GET, status, state, list, WebSocket live feed | ⚠️ Partial | 70% | CRUD works; WebSocket is a placeholder comment, not implemented |
| **Module 5 — Eligibility** | POST /eligibility/compute (weighted formula), GET /:app_id | ✅ Done | 85% | Full formula: Academic 25% + Financial 30% + PQ 20% + DocTrust 15% + KYC 10%; PQ override logic implemented |
| **Module 6 — AI Bridge** | POST /ai/kyc-result, behavioral-result, fraud-result, scholarship-result, explanation-result | ✅ Done | 80% | All 5 endpoints accept calls from Person C; fire corresponding Kafka events |
| **Module 7 — Scholarships** | GET /scholarships/list, /:app_id/matches, POST /apply | ❌ Stub | 35% | Endpoints exist but return empty arrays; no real data or matching logic |
| **Module 8 — Disbursal** | POST /disbursal/schedule, /release/:app_id/semester/:n, GET schedule | ⚠️ Partial | 65% | Release writes to DB and fires `loan.disbursed` Kafka event ✅; schedule and GET return empty |
| **Module 9 — Semester Gate** | POST /semester-gate/trigger, /submit-marksheet | ⚠️ Partial | 60% | Trigger fires Kafka event ✅; submit-marksheet is a stub |
| **Module 10 — Notifications** | POST /notifications/send | ⚠️ Stub | 35% | Endpoint exists, returns `{status: sent}` but no real notification dispatch |
| **Module 11 — Audit** | GET /audit/:app_id/trail, POST /grievance | ⚠️ Partial | 50% | Grievance returns ticket_id; audit trail returns empty array |
| PostgreSQL Integration | DB schema + queries | ⚠️ Partial | 65% | Tables referenced in SQL queries (users, profiles, documents, applications, eligibility_scores, audit_logs, disbursal_schedule); schema not in repo; graceful mock fallback |
| Kafka Producer | Fires events for all state transitions | ✅ Done | 80% | All key events published: `document.uploaded`, `app.submitted`, `eligibility.calculated`, `loan.disbursed`, `approval.decided` |
| Kafka Consumer | Consume AI results, update DB | ❌ Missing | 0% | B does not consume any Kafka topics; AI results only arrive via REST |
| MinIO Integration | File storage for documents | ❌ Missing | 0% | Not implemented; upload endpoint does not store to MinIO |
| Redis | Session cache | ❌ Missing | 0% | Not implemented |
| `/users/:id/app-count?days=30` | Person C calls this for fraud | ❌ Missing | 0% | Not implemented |
| JWT Middleware | Auth on protected routes | ⚠️ Partial | 50% | JWT generation implemented; middleware not applied to protected routes consistently |

### What's Missing (Person B)
- `GET /users/check-pan` and `GET /users/check-aadhaar` — critical for Person C fraud pipeline
- `GET /users/:id/app-count?days=30` — needed by Person C
- Full profile field upsert (only sets kyc_status, ignores aadhaar/pan/bank/income etc.)
- MinIO integration for document storage
- WebSocket for `/applications/:id/live`
- Real scholarship matching logic
- Kafka consumer (B does not process any inbound events)
- Full DB schema migration file missing from repo

---

## Person A — Frontend (Branch: `amit`)

### Feature Coverage

| Feature / Module | Requirement | Status | % Done | Notes |
|---|---|---|---|---|
| **Tech Stack Setup** | React 18, TS, Vite/Next, Tailwind, Zustand, React Query, Axios, Framer Motion, Recharts | ✅ Done | 95% | All dependencies present; uses Next.js 14 App Router instead of Vite (acceptable) |
| **Route: / (Landing)** | 3 intent cards, language selector, full-viewport layout | ✅ Done | 95% | Visually complete; language selector present (UI only, no i18n wiring) |
| **Route: /register** | Form + OTP, validation (zod), resend countdown | ✅ Done | 80% | Full form with validation; API call is simulated (no real backend call) |
| **Route: /login** | Mobile/email + password, JWT store | ✅ Done | 80% | Form complete; uses dummy JWT token |
| **Route: /onboarding** | WhatsApp-style chatbot, 11-step flow, masked inputs | ✅ Done | 85% | All 11 questions implemented; chat bubble UI present; no real PUT /users/profile call |
| **Route: /onboarding/kyc** | Doc upload (react-dropzone), webcam capture, face match UI | ✅ Done | 75% | DocumentCard + WebcamCapture components present; no real POST /documents/upload |
| **Route: /assessment** | 8 behavioral questions, one per screen, timed, MCQ + free text | ✅ Done | 85% | QuestionCard component; calls `getBehavioralQuestions` / `submitBehavioralAnswers` via API lib (dummy) |
| **Route: /application/status** | WebSocket live pipeline tracker | ⚠️ Partial | 65% | PipelineStage UI complete; `useApplicationStatusSocket` hook built with polling fallback; no real WebSocket server to connect to |
| **Route: /application/result** | Score radar, PQ badge, explainability | ✅ Done | 75% | ScoreRadar + PQBadge components present; hardcoded data |
| **Route: /dashboard** | Semester tracker, scholarship matches, notifications | ✅ Done | 70% | Full layout; hardcoded data; no real API calls |
| **Route: /dashboard/semester/:n** | Semester gate — marksheet upload | ✅ Done | 70% | Page exists; no real API call |
| **Route: /scholarships** | Matched scholarships list | ✅ Done | 70% | Page exists; data hardcoded |
| **Route: /admin** | Redirects to /admin/applications | ✅ Done | 90% | Clean redirect logic |
| **Route: /admin/applications** | Application queue, filter by status/fraud flag | ✅ Done | 75% | Full mock UI with filter, fraud flags; hardcoded data |
| **Route: /admin/application/:id** | Single application detail, score breakdown | ✅ Done | 70% | Page exists; mock data |
| **Chat Widget** | AI chat bubble on dashboard, calls POST /chat/message | ⚠️ Partial | 55% | UI complete and toggleable; response is hardcoded mock string; no call to Person C's `/chat/message` |
| **Zustand Stores** | auth, intent, onboarding, application, assessment, chat, document, scholarship | ✅ Done | 90% | All 8 stores present and typed |
| **API Layer (lib/api.ts)** | Axios instance + real API call functions | ⚠️ Partial | 45% | Axios instance configured; most functions use `delay()` simulation instead of real HTTP calls; interceptors set up but auth token not injected |
| **Protected Routes** | Redirect unauthenticated users | ✅ Done | 85% | `ProtectedRoute` component implemented |
| **i18n (Hindi / Odia / English)** | i18next, 3 language JSON files | ❌ Missing | 5% | Language selector renders in UI; `i18next` not configured; no translation files |
| **MSW Mocks** | Mock service worker for all endpoints | ❌ Missing | 0% | Not set up; `npx msw init public/` not run |
| **Real WebSocket** | socket.io-client connected to live backend | ⚠️ Partial | 30% | Hook written; polling fallback works; no WS server to connect to (Person B not implemented) |
| **Recharts / Score Visualisation** | Radar chart for score breakdown | ✅ Done | 80% | ScoreRadar component with recharts |
| **react-webcam** | Camera capture for selfie/KYC | ✅ Done | 80% | WebcamCapture component built |
| **react-dropzone** | Document upload UI | ✅ Done | 80% | DocumentCard with drag-and-drop |

### What's Missing (Person A)
- Real API integration — all calls are simulated with `delay()`; need to wire axios calls to actual endpoints
- i18n setup (i18next not configured, no translation JSON files)
- MSW mock handlers not initialized
- Chat widget not calling Person C's `/chat/message`
- Dashboard data hardcoded (no real fetch from backend)

---

## End-to-End Feature Flow Status

| User Journey / Feature | A (Frontend) | B (Backend) | C (AI Service) | E2E % |
|---|---|---|---|---|
| Student Registration + OTP | 80% | 75% | N/A | **70%** |
| Chatbot Onboarding (profile collection) | 85% | 55% | N/A | **65%** |
| KYC Document Upload (MinIO) | 75% | 65% | 85% | **55%** |
| OCR Document Processing | N/A | 65% | 85% | **60%** |
| Face Match (Aadhaar vs Selfie) | 75% | 0% (no MinIO) | 90% | **45%** |
| Fraud Detection Pipeline | N/A | 80% | 85% | **65%** |
| Duplicate PAN / Aadhaar check | N/A | **0%** | 85% | **30%** |
| Behavioral PQ Assessment | 85% | 80% | 85% | **80%** |
| Eligibility Scoring (weighted formula) | 65% | 85% | 85% | **75%** |
| LangGraph Agent Orchestration | N/A | 80% | 85% | **75%** |
| Scholarship Matching (Qdrant RAG) | 70% | 35% | 80% | **55%** |
| Decision Explanation (AI narrative) | 75% | 80% | 80% | **75%** |
| Live Application Status (WebSocket) | 65% | 0% | N/A | **25%** |
| Loan Disbursal (semester-wise) | 70% | 65% | N/A | **65%** |
| Semester Gate + Marksheet Upload | 70% | 60% | N/A | **60%** |
| Admin Dashboard (queue + detail) | 75% | 65% | N/A | **65%** |
| AI Chat Widget (RAG) | 55% | 80% | 80% | **55%** |
| DigiLocker OAuth | 0% | 40% | N/A | **15%** |
| Notifications (SMS/email dispatch) | N/A | 35% | N/A | **20%** |
| Audit Trail | N/A | 50% | N/A | **40%** |
| i18n (Hindi / Odia / English) | 5% | N/A | 80% | **25%** |

---

## Summary — What's Remaining

### Person C — ~15% remaining
- [ ] Wire XGBoost risk model into eligibility scoring
- [ ] Add LayoutLM or improve Groq-based doc structuring confidence
- [ ] Expand test coverage (edge cases: bad images, Kafka timeout, Qdrant unavailable)
- [ ] Add detailed `/health` probe for all dependencies

### Person B — ~40% remaining
- [ ] **Critical:** Implement `GET /users/check-pan` and `GET /users/check-aadhaar` (blocks Person C fraud pipeline)
- [ ] **Critical:** Implement `GET /users/:id/app-count?days=30`
- [ ] Full profile field upsert in `PUT /users/:id/profile`
- [ ] MinIO integration for document storage
- [ ] WebSocket server for `/applications/:id/live`
- [ ] Real scholarship data + matching endpoint
- [ ] DB migration schema file
- [ ] Redis integration
- [ ] JWT middleware on all protected routes
- [ ] Full audit trail and notification dispatch

### Person A — ~28% remaining
- [ ] **Critical:** Wire all API calls from `lib/api.ts` to real backend (remove `delay()` simulations)
- [ ] Inject JWT token in axios request interceptor
- [ ] Configure i18next + create en/hi/od translation JSON files
- [ ] Set up MSW mock handlers (`npx msw init public/`)
- [ ] Connect Chat Widget to Person C's `POST /chat/message`
- [ ] Wire dashboard/scholarships/result pages to real API data
- [ ] Real WebSocket connection in `useApplicationStatusSocket`

---

## Integration Blockers (Cross-Person)

| Blocker | Blocks | Owner |
|---|---|---|
| `GET /users/check-pan` + `check-aadhaar` not implemented | Person C fraud pipeline | **Person B** |
| MinIO not integrated in backend | OCR, face match pipelines | **Person B** |
| WebSocket not implemented | Live status screen | **Person B** |
| API calls all simulated (no real HTTP) | Full end-to-end flow | **Person A** |
| JWT not injected in axios | All authenticated flows | **Person A** |
| Chat widget calls mock, not Person C | RAG chat feature | **Person A** |
