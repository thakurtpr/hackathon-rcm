# AI-Enabled Student Loan Eligibility, Application, Disbursal & Agentic Scholarship Approval System

A production-grade, locally-deployable AI system built for Hackforge 2.0 (SPARC — Igniting Innovations).

## Architecture

```
├── ai_service/    # Python FastAPI + LangGraph + Groq (port 8001)
├── backend/       # Go Gin + PostgreSQL + Kafka (port 8000)
├── frontend/      # Next.js 14 + TypeScript + Tailwind (port 3000)
├── infra/         # schema.sql, seeds, kafka-topics.json
├── docker-compose.yml
├── docker-compose.dev.yml
└── Makefile
```

## Quick Start (Single Command)

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env: set GROQ_API_KEY and other secrets

# 2. Start everything
make up
# or: docker compose up

# 3. Check health
make health
```

## Development Setup

```bash
# Start only infrastructure (postgres, redis, kafka, minio, qdrant)
make dev
# or: docker compose -f docker-compose.dev.yml up -d

# Run services locally
make dev-ai       # Python AI service (port 8001)
make dev-backend  # Go backend (port 8000)
make dev-frontend # Next.js frontend (port 3000)
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make up` | Start all services via docker compose |
| `make down` | Stop all services |
| `make logs` | Follow all service logs |
| `make seed` | Seed Qdrant + scholarships database |
| `make test` | Run AI service tests (≥80% coverage) |
| `make health` | Check all service health endpoints |
| `make clean` | Stop services and remove volumes |

## Services

### Infrastructure
| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL 16 | 5432 | Primary database |
| Redis 7 | 6379 | Session cache + pubsub |
| MinIO | 9000/9001 | Document storage (bucket: loan-docs) |
| Kafka | 9092 | Event streaming |
| Qdrant | 6333 | Vector search (scholarships, face embeddings) |

### Application Services
| Service | Port | Stack |
|---------|------|-------|
| AI Service | 8001 | Python FastAPI + LangGraph + Groq |
| Backend API | 8000 | Go Gin + PostgreSQL |
| Frontend | 3000 | Next.js 14 + TypeScript |

## API Endpoints

### Backend (Port 8000)
- `POST /auth/register` — Register user
- `POST /auth/verify-otp` — Verify OTP (dev: use 123456)
- `POST /auth/login` — Login
- `GET /users/check-pan?pan=<hash>` — Duplicate PAN check
- `GET /users/check-aadhaar?hash=<hash>` — Duplicate Aadhaar check
- `GET /users/:id/app-count?days=30` — Application count
- `PUT /users/:id/profile` — Full profile upsert
- `POST /documents/upload` — Upload to MinIO + trigger Kafka
- `POST /applications` — Create application
- `GET /applications/:id/live` — WebSocket live status
- `POST /eligibility/compute` — Compute eligibility score
- `GET /scholarships/list` — List all scholarships
- `GET /scholarships/:id/matches` — Get matched scholarships
- `GET /health` — Health check

### AI Service (Port 8001)
- `GET /health` — Detailed health (groq, qdrant, redis, minio, model)
- `GET /behavioral/questions?app_id=` — Get behavioral questions
- `POST /behavioral/submit` — Submit answers + score
- `POST /chat/message` — RAG chat (Hindi/English/Odia)
- `GET /users/check-pan` — PAN dedup proxy
- `GET /users/check-aadhaar` — Aadhaar dedup proxy

## Kafka Topics

See `infra/kafka-topics.json` for full schema registry:
- `document.uploaded` → triggers OCR + face match
- `app.submitted` → triggers fraud detection + behavioral questions
- `eligibility.calculated` → triggers scholarship matching + explanation
- `behavioral.scored`, `kyc.completed`, `fraud.checked`
- `scholarship.matched`, `explanation.ready`
- `loan.disbursed`, `approval.decided`

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
GROQ_API_KEY=gsk_...     # Required for AI features
DB_PASSWORD=postgres     # PostgreSQL password
JWT_SECRET=...           # Change in production (32+ chars)
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

## Testing

```bash
# Run AI service tests (≥80% coverage)
make test

# Or directly:
cd ai_service && pytest tests/ -v --cov=app --cov-report=term-missing
```

## Languages Supported

- English (en)
- Hindi (hi / हिन्दी)  
- Odia (or / ଓଡ଼ିଆ)
