#!/usr/bin/env bash
# deploy.sh — Safe deploy with automatic image backup and one-command rollback
# Usage:
#   ./scripts/deploy.sh           # build + deploy (backs up current images first)
#   ./scripts/deploy.sh rollback  # restore last backup images and restart

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose"
PROJECT="hackforge-20"   # docker compose project name (folder name, lowercased, dashes stripped)
SERVICES="backend ai-service frontend"
BACKUP_TAG="backup-$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE=".last_backup_tag"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()    { echo -e "${YELLOW}[deploy]${NC} $*"; }
error()   { echo -e "${RED}[deploy]${NC} $*"; }

# ── Rollback mode ─────────────────────────────────────────────────────────────
if [[ "${1:-}" == "rollback" ]]; then
  if [[ ! -f "$BACKUP_FILE" ]]; then
    error "No backup tag found ($BACKUP_FILE missing). Cannot rollback."
    exit 1
  fi
  RESTORE_TAG=$(cat "$BACKUP_FILE")
  warn "Rolling back to images tagged: $RESTORE_TAG"

  for svc in $SERVICES; do
    IMAGE="${PROJECT}-${svc}"
    BACKUP_IMAGE="${IMAGE}:${RESTORE_TAG}"
    if docker image inspect "$BACKUP_IMAGE" &>/dev/null; then
      info "Restoring $svc from $BACKUP_IMAGE"
      docker tag "$BACKUP_IMAGE" "${IMAGE}:latest"
    else
      warn "Backup image $BACKUP_IMAGE not found — skipping $svc"
    fi
  done

  info "Restarting services with restored images..."
  $COMPOSE up -d --no-build
  info "Rollback complete. Run '$COMPOSE logs -f' to verify."
  exit 0
fi

# ── Normal deploy ─────────────────────────────────────────────────────────────

# 1. Backup currently running images
info "Backing up current images with tag: $BACKUP_TAG"
for svc in $SERVICES; do
  IMAGE="${PROJECT}-${svc}"
  CURRENT_ID=$(docker image inspect "${IMAGE}:latest" --format '{{.Id}}' 2>/dev/null || true)
  if [[ -n "$CURRENT_ID" ]]; then
    docker tag "${IMAGE}:latest" "${IMAGE}:${BACKUP_TAG}"
    info "  ✓ ${IMAGE}:latest → ${IMAGE}:${BACKUP_TAG}"
  else
    warn "  ~ ${IMAGE}:latest not found (first deploy?), skipping backup"
  fi
done
echo "$BACKUP_TAG" > "$BACKUP_FILE"
info "Backup tag saved to $BACKUP_FILE"

# 2. Also dump Postgres data as a safety net
if docker compose ps postgres 2>/dev/null | grep -q "running"; then
  DUMP_FILE="backups/pg_dump_${BACKUP_TAG}.sql"
  mkdir -p backups
  info "Dumping PostgreSQL data → $DUMP_FILE"
  $COMPOSE exec -T postgres pg_dump -U "${DB_USER:-postgres}" "${DB_NAME:-hackforge}" > "$DUMP_FILE" 2>/dev/null || \
    warn "  pg_dump failed (DB may be empty) — continuing"
fi

# 3. Build new images
info "Building new images..."
$COMPOSE build --parallel

# 4. Apply new images with rolling restart (infra stays up)
info "Deploying new images..."
$COMPOSE up -d --no-deps backend ai-service frontend

# 5. Health check
info "Waiting for health checks (up to 60s)..."
TIMEOUT=60
ELAPSED=0
ALL_OK=false
while [[ $ELAPSED -lt $TIMEOUT ]]; do
  BACKEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' \
    "$($COMPOSE ps -q backend 2>/dev/null)" 2>/dev/null || echo "none")
  AI_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' \
    "$($COMPOSE ps -q ai-service 2>/dev/null)" 2>/dev/null || echo "none")

  if [[ "$BACKEND_HEALTH" == "healthy" && "$AI_HEALTH" == "healthy" ]]; then
    ALL_OK=true
    break
  fi

  echo -n "."
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done
echo ""

if [[ "$ALL_OK" == "true" ]]; then
  info "All services healthy. Deploy successful!"
  info "To rollback if needed: ./scripts/deploy.sh rollback"
else
  error "Health check timed out! Services may be unhealthy."
  error "Automatically rolling back to $BACKUP_TAG ..."
  for svc in $SERVICES; do
    IMAGE="${PROJECT}-${svc}"
    BACKUP_IMAGE="${IMAGE}:${BACKUP_TAG}"
    if docker image inspect "$BACKUP_IMAGE" &>/dev/null; then
      docker tag "$BACKUP_IMAGE" "${IMAGE}:latest"
    fi
  done
  $COMPOSE up -d --no-build
  error "Rollback applied. Check logs: docker compose logs -f"
  exit 1
fi
