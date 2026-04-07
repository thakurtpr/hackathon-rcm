#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting redeployment and verification...${NC}"

# 1. Stop existing services and clear conflicts
echo -e "${BLUE}🛑 Stopping existing and conflicting services...${NC}"

# Stop docker-compose managed services and remove volumes for a clean start
make clean

# Stop Kind clusters that might be hogging ports (e.g., 5432)
if command -v kind &> /dev/null; then
    KIND_CLUSTERS=$(kind get clusters 2>/dev/null)
    if [ ! -z "$KIND_CLUSTERS" ]; then
        echo -e "${BLUE}⚠️  Stopping Kind clusters to free up ports...${NC}"
        for cluster in $KIND_CLUSTERS; do
            kind delete cluster --name "$cluster" || true
        done
    fi
fi

# 2. Build and start services
echo -e "${BLUE}🛠  Building and starting updated codebase...${NC}"
make build
make up

# 3. Wait for services to be healthy
echo -e "${BLUE}⏳ Waiting for services to stabilize (this may take a minute)...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0
ALL_HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo -n "."
    # Check if all services in docker-compose are healthy
    HEALTH_STATUS=$(docker compose ps --format json | jq -r '.[].Health' 2>/dev/null)
    
    # If no health info yet, or any is starting/unhealthy
    if [[ -z "$HEALTH_STATUS" ]] || echo "$HEALTH_STATUS" | grep -q "starting" || echo "$HEALTH_STATUS" | grep -q "unhealthy"; then
        sleep 5
        RETRY_COUNT=$((RETRY_COUNT+1))
    else
        ALL_HEALTHY=true
        break
    fi
done

echo ""

if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}✅ All services are UP and HEALTHY!${NC}"
else
    echo -e "${RED}⚠️  Some services might still be starting or failed. Checking logs...${NC}"
fi

# 4. Final health check summary
make health

# 5. Run tests (optional, but good for verification)
echo -e "${BLUE}🧪 Running AI and Backend tests...${NC}"
make test-ai
make test-backend

echo -e "${GREEN}✨ Verification complete!${NC}"
echo -e "You can view logs with: ${BLUE}make logs${NC}"
