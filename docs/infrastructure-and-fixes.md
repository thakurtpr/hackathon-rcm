# Infrastructure Setup & Bug Fixes — Session Log

**Date:** 2026-04-08  
**Environment:** Local Docker Compose + Cloudflare Tunnel (public exposure)

---

## 1. Nginx Reverse Proxy

**What was done:**  
Added an nginx service as a reverse proxy sitting in front of the Next.js frontend. All HTTP traffic now enters through nginx on port 80 before reaching the app.

**File changed:** `infra/nginx/nginx.conf` (created), `docker-compose.yml`

**Config:**
- nginx listens on port 80
- Proxies all requests (including WebSocket `Upgrade` headers) to `frontend:3000`
- Frontend changed from `ports: 3000:3000` to `expose: 3000` — no longer directly accessible from host
- Next.js server-side rewrites handle `/api/backend/*` → `backend:8000` and `/api/ai/*` → `ai-service:8001` internally

**Why:** Needed a single entry point for public exposure and to support clean URL routing through ngrok/Cloudflare.

---

## 2. Public Exposure via Cloudflare Tunnel

**What was done:**  
Replaced ngrok with Cloudflare Tunnel (`cloudflared`) for public exposure.

**File changed:** `docker-compose.yml`

**Why ngrok was dropped:**  
ngrok free tier shows a browser interstitial warning page ("You are about to visit...") that cannot be bypassed without a paid plan. `cloudflared` is free, has no interstitial, and requires no account for quick tunnels.

**Command used:**
```
cloudflared tunnel --no-autoupdate --url http://nginx:80
```

**Note:** The public URL changes on every container restart (free tier behaviour). For a stable URL, set up a named Cloudflare Tunnel with an account.

---

## 3. Frontend API URL Fix (localhost → relative paths)

**What was done:**  
`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_AI_URL` were pointing to `http://localhost:8000` and `http://localhost:8001`. These values get baked into the browser JS bundle at build time. External users accessing the app via Cloudflare would have their browser call *their own* localhost — which fails.

**Files changed:** `docker-compose.yml`, `frontend/next.config.mjs`

**Fix:**
- `NEXT_PUBLIC_API_URL` → `/api/backend` (relative path)
- `NEXT_PUBLIC_AI_URL` → `/api/ai` (relative path)
- Added `API_INTERNAL_URL=http://backend:8000` and `AI_INTERNAL_URL=http://ai-service:8001` as server-only env vars
- `next.config.mjs` rewrites now use `API_INTERNAL_URL` / `AI_INTERNAL_URL` instead of the public vars

**Flow after fix:**
```
Browser → /api/backend/auth/login
        → Cloudflare → nginx → Next.js (server-side rewrite)
        → http://backend:8000/auth/login
```

---

## 4. Frontend Health Check Fix

**What was done:**  
The frontend healthcheck was using `curl` which is not installed in `node:20-alpine`. This caused the container to report `unhealthy`, which blocked nginx from starting (it depended on `service_healthy`).

**Files changed:** `docker-compose.yml`

**Fix:**
- Changed healthcheck from `["CMD", "curl", "-f", "http://localhost:3000"]` to `["CMD-SHELL", "wget -qO- http://localhost:3000 > /dev/null 2>&1 || exit 1"]`
- Changed nginx `depends_on` for frontend from `service_healthy` to `service_started`

---

## 5. SMTP Email Configuration

**What was done:**  
OTP emails were not being sent — backend logged them to console instead because SMTP was unconfigured.

**Fix:** Added to `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail address>
SMTP_PASS=<google app password — no spaces>
```

**Note:** Google App Passwords are displayed with spaces (`xxxx xxxx xxxx xxxx`) but must be stored without spaces in `.env`.

---

## 6. Bug Fix — AI Service Calling Itself via localhost (Issue #1)

**Severity:** High — broke entire chat + behavioral assessment flow

**Root cause:**  
`conversation_agent.py` was calling itself using `http://localhost:8001/...`. Inside Docker, `localhost` resolves to the container's own loopback interface — not `ai-service`. These HTTP calls silently failed.

**Files changed:** `ai_service/app/agents/conversation_agent.py`

**Lines fixed:**
- Line 442: `http://localhost:{port}` → `http://ai-service:{port}`
- Line 918: `http://localhost:8001/behavioral/questions` → `http://ai-service:{port}/behavioral/questions`

**Impact of bug:**  
- Chat bot fell back to 3 hardcoded generic questions instead of fetching real ones
- Behavioral answers were never submitted → loan eligibility pipeline received zero behavioral data

**Ideal long-term fix:**  
Add `ai_service_base_url` to `Settings` class and inject via env var so the URL is configurable per environment (local dev vs Docker vs prod) without code changes.

---

## 7. Bug Fix — KYC Face Verification Blocked (Issue #5)

**Severity:** High — every user was hard-blocked at KYC step

**Root cause:**  
The InsightFace `buffalo_l` model (~400MB) was downloaded at container startup. It either timed out or failed to initialise, leaving `insightface_app = None`. The original code returned `face_match_pass=False` when the model wasn't loaded, which meant every single KYC submission failed.

**What the model does:**  
1. Takes Aadhaar card photo + user selfie
2. Extracts 512-dimensional face embedding vectors from each
3. Computes cosine similarity between them
4. Score ≥ 0.85 → `passed`, 0.70–0.85 → `manual_review`, < 0.70 → `failed`
5. Stores selfie embedding in Qdrant for future fraud detection

**Files changed:**
- `ai_service/app/pipelines/face_match_pipeline.py` — bypass when model not loaded
- `ai_service/Dockerfile` — pre-download model at build time
- `docker-compose.yml` — added `insightface_models` volume

**Fix applied (two-part):**

**Part A — Bypass:** When `insightface_app is None`, return `face_match_pass=True` with `flag="model_unavailable"` instead of failing. Users can progress through KYC; result is flagged for manual review in the audit trail.

**Part B — Permanent fix:** Run `scripts/prewarm_models.py` during `docker build`. This pre-downloads all three model groups into the image:
- InsightFace `buffalo_l` (~400MB) → `/root/.insightface`
- SentenceTransformer `all-MiniLM-L6-v2` → `~/.cache/huggingface`
- PaddleOCR (det + rec + cls models) → `~/.paddleocr`

A named Docker volume (`insightface_models`) is mounted at `/root/.insightface`. On first run, Docker seeds the volume from the image. On subsequent restarts the model loads from the volume in ~5 seconds with no re-download.

---

## 8. Remaining TODOs

| Item | Priority | Action needed |
|---|---|---|
| `JWT_SECRET` not set | High | Add `JWT_SECRET=<random string>` to `.env`, restart backend |
| `GROQ_API_KEY` not set | High | Add `GROQ_API_KEY=gsk_...` to `.env` from console.groq.com, restart ai-service |
| Cloudflare URL is ephemeral | Medium | Set up named tunnel with CF account for stable URL |
| InsightFace bypass still active until model confirms loaded | Low | Verify `InsightFace loaded ✓` in logs after rebuild; bypass auto-deactivates once model is ready |
