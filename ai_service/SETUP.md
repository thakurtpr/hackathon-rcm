# AI Service Setup Guide

## Quick Start

Follow these steps to get the Hackforge AI Service running locally.

### Step 1 — Get a Groq API Key (free)

1. Go to [console.groq.com](https://console.groq.com) and sign up for a free account
2. Navigate to **API Keys** and click **Create API Key**
3. Copy the key (starts with `gsk_...`)

### Step 2 — Configure your environment

```bash
cp ai_service/.env.example ai_service/.env
```

Open `ai_service/.env` and replace `YOUR_GROQ_API_KEY_FROM_CONSOLE_GROQ_COM` with your real key:

```
GROQ_API_KEY=gsk_your_actual_key_here
```

### Step 3 — Start infrastructure (Docker)

```bash
docker compose up -d
```

This starts: Kafka, Zookeeper, Redis, Qdrant, MinIO, and the backend service.

### Step 4 — Seed demo data

```bash
.venv/bin/python scripts/demo_seed.py
```

This seeds Redis and Qdrant with Rajan Kumar's demo profile, loan policy documents, and pre-computed behavioral scores.

### Step 5 — Start the AI Service

```bash
.venv/bin/uvicorn app.main:app --port 8001
```

The service will be available at `http://localhost:8001`.

Health check: `curl http://localhost:8001/health`

## Notes

- A Groq API key is **optional** — the service falls back to Ollama (if running locally) or returns mock responses if neither is configured.
- InsightFace downloads the `buffalo_l` model (~400 MB) on first startup — this only happens once and is cached locally.
- PaddleOCR on Apple Silicon (M1/M2/M3) is automatically configured for CPU mode.
