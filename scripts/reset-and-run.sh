#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# reset-and-run.sh — nuke volumes, rebuild images, and relaunch
# Run from the hackforge repo root:  bash reset-and-run.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║      HackForge Fresh-Boot Script            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: tear everything down, including named volumes ────────
echo "🛑  [1/4] Stopping containers and removing volumes..."
docker compose down --volumes --remove-orphans 2>&1 | sed 's/^/    /'

# ── Step 2: rebuild every image without cache ────────────────────
echo ""
echo "🔨  [2/4] Rebuilding all images (--no-cache)..."
echo "    (This may take several minutes on the first run)"
docker compose build --no-cache 2>&1 | sed 's/^/    /'

# ── Step 3: start services detached ────────────────────────────
echo ""
echo "🚀  [3/4] Launching services..."
docker compose up -d 2>&1 | sed 's/^/    /'

# ── Step 4: wait for backend health-check ────────────────────────
echo ""
echo "⏳  [4/4] Waiting for backend (http://localhost:8000/health)..."
RETRIES=40
for i in $(seq 1 $RETRIES); do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "    ✅  Backend healthy after $i attempt(s)!"
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo "    ⚠️  Backend did not become healthy in time."
    echo "    Check logs:  docker compose logs backend"
  fi
  printf "    attempt %d/%d — sleeping 3s...\r" "$i" "$RETRIES"
  sleep 3
done

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo "📋  Current service status:"
docker compose ps
echo ""
echo "🎉  Done!"
echo "    Frontend : http://localhost:3000"
echo "    Backend  : http://localhost:8000"
echo "    AI svc   : http://localhost:8001"
echo "    MinIO UI  : http://localhost:9001  (user: minioadmin / minioadmin)"
echo ""
