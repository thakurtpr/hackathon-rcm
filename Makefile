.PHONY: up down logs seed test health clean build dev

# Load env file
ifneq (,$(wildcard .env))
    include .env
    export
endif

# ── Core Commands ──────────────────────────────────────────────────────────────

up:
	@echo "🚀 Starting all services..."
	@cp -n .env.example .env 2>/dev/null || true
	docker compose up -d --build
	@echo "✅ Services started. Run 'make health' to check status."

down:
	@echo "🛑 Stopping all services..."
	docker compose down

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-ai:
	docker compose logs -f ai-service

logs-frontend:
	docker compose logs -f frontend

# ── Development ────────────────────────────────────────────────────────────────

dev:
	@echo "🛠  Starting infrastructure only (postgres, redis, kafka, minio, qdrant)..."
	docker compose up -d postgres redis kafka zookeeper minio qdrant
	@echo "Run 'make dev-ai' and 'make dev-backend' and 'make dev-frontend' in separate terminals"

dev-ai:
	cd ai_service && uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

dev-backend:
	cd backend && go run .

dev-frontend:
	cd frontend && npm run dev

# ── Seeding ────────────────────────────────────────────────────────────────────

seed:
	@echo "🌱 Seeding database and Qdrant..."
	@docker compose exec ai-service python scripts/seed_qdrant.py || \
		(cd ai_service && python scripts/seed_qdrant.py)
	@echo "✅ Seed complete"

seed-model:
	@echo "🤖 Training XGBoost risk model..."
	@docker compose exec ai-service python scripts/train_risk_model.py || \
		(cd ai_service && python scripts/train_risk_model.py)

# ── Testing ────────────────────────────────────────────────────────────────────

test:
	@echo "🧪 Running all tests..."
	$(MAKE) test-ai

test-ai:
	@echo "🧪 Running AI service tests..."
	cd ai_service && python -m pytest tests/ -v --tb=short --cov=app --cov-report=term-missing

test-backend:
	@echo "🧪 Running backend tests..."
	cd backend && go test ./...

# ── Health Checks ──────────────────────────────────────────────────────────────

health:
	@echo "🏥 Checking service health..."
	@echo ""
	@echo "Backend API:"
	@curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null || echo "  ❌ Not reachable"
	@echo ""
	@echo "AI Service:"
	@curl -s http://localhost:8001/health | python3 -m json.tool 2>/dev/null || echo "  ❌ Not reachable"
	@echo ""
	@echo "Frontend:"
	@curl -sf http://localhost:3000 > /dev/null && echo "  ✅ Frontend reachable" || echo "  ❌ Not reachable"
	@echo ""
	@echo "Qdrant:"
	@curl -sf http://localhost:6333/healthz && echo "" || echo "  ❌ Not reachable"

health-infra:
	@echo "Infrastructure health:"
	@docker compose ps

# ── Cleanup ────────────────────────────────────────────────────────────────────

clean:
	@echo "🧹 Cleaning up..."
	docker compose down -v --remove-orphans
	@echo "✅ Cleaned"

build:
	docker compose build --no-cache

# ── Migrations ────────────────────────────────────────────────────────────────

migrate:
	@echo "🗄  Running migrations..."
	docker compose exec backend ./backend -migrate || echo "Migrations run on startup"

# ── Utilities ─────────────────────────────────────────────────────────────────

shell-db:
	docker compose exec postgres psql -U ${DB_USER:-postgres} -d ${DB_NAME:-hackforge}

shell-redis:
	docker compose exec redis redis-cli

kafka-topics:
	docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list
