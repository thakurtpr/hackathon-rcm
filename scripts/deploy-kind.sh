#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== Kind Cluster Deployment ===${NC}"

# 1. Install kind if not present
if ! command -v kind &>/dev/null; then
    echo -e "${BLUE}Installing kind...${NC}"
    curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.27.0/kind-linux-amd64
    chmod +x ./kind
    sudo mv ./kind /usr/local/bin/kind
    echo -e "${GREEN}kind installed${NC}"
fi

# 2. Install kubectl if not present
if ! command -v kubectl &>/dev/null; then
    echo -e "${BLUE}Installing kubectl...${NC}"
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    chmod +x kubectl
    sudo mv kubectl /usr/local/bin/kubectl
    echo -e "${GREEN}kubectl installed${NC}"
fi

# 3. Delete existing kind cluster if present
if kind get clusters 2>/dev/null | grep -q hackforge; then
    echo -e "${BLUE}Deleting existing hackforge cluster...${NC}"
    kind delete cluster --name hackforge
fi

# 4. Create kind cluster with port mappings
echo -e "${BLUE}Creating kind cluster...${NC}"
kind create cluster --name hackforge --config infra/k8s/kind-config.yaml --wait 60s
echo -e "${GREEN}Kind cluster created${NC}"

# 5. Load Docker images into kind (skip ai-service — 14.5GB, uses ExternalName to host)
echo -e "${BLUE}Loading Docker images into kind...${NC}"
IMAGES=("hackathon-rcm-backend" "hackathon-rcm-frontend")
for img in "${IMAGES[@]}"; do
    if docker image inspect "$img:latest" &>/dev/null; then
        echo "  Loading $img..."
        kind load docker-image "$img:latest" --name hackforge
    else
        echo -e "${RED}  Image $img:latest not found — building...${NC}"
        case $img in
            hackathon-rcm-backend)  docker compose build backend && kind load docker-image "$img:latest" --name hackforge ;;
            hackathon-rcm-frontend) docker compose build frontend && kind load docker-image "$img:latest" --name hackforge ;;
        esac
    fi
done

# Load infra images (already pulled by docker compose)
echo -e "${BLUE}Loading infrastructure images...${NC}"
INFRA_IMAGES=("postgres:16-alpine" "redis:7-alpine" "minio/minio" "confluentinc/cp-zookeeper:7.6.0" "confluentinc/cp-kafka:7.6.0" "qdrant/qdrant:latest" "nginx:alpine")
for img in "${INFRA_IMAGES[@]}"; do
    echo "  Loading $img..."
    kind load docker-image "$img" --name hackforge 2>/dev/null || echo "  Warning: could not load $img"
done

echo -e "${GREEN}All images loaded${NC}"

# 6. Apply k8s manifests
echo -e "${BLUE}Applying k8s manifests...${NC}"
kubectl apply -f infra/k8s/hackforge.yaml
echo -e "${GREEN}Manifests applied${NC}"

# 7. Wait for pods to come up
echo -e "${BLUE}Waiting for pods to be ready (this may take a few minutes)...${NC}"
kubectl -n hackforge wait --for=condition=ready pod -l app=postgres --timeout=120s 2>/dev/null || true
kubectl -n hackforge wait --for=condition=ready pod -l app=redis --timeout=120s 2>/dev/null || true
kubectl -n hackforge wait --for=condition=ready pod -l app=backend --timeout=180s 2>/dev/null || true
kubectl -n hackforge wait --for=condition=ready pod -l app=nginx --timeout=120s 2>/dev/null || true

# 8. Status check
echo ""
echo -e "${GREEN}=== Deployment Status ===${NC}"
kubectl -n hackforge get pods -o wide
echo ""
kubectl -n hackforge get svc
echo ""
echo -e "${GREEN}=== Access Points ===${NC}"
echo "  Nginx (main):    http://localhost:30080"
echo "  Backend API:     http://localhost:30000"
echo "  Frontend direct: http://localhost:30002"
echo "  MinIO Console:   http://localhost:30003"
echo "  AI Service:      via Docker Compose at host:8001 (ExternalName)"
echo ""
echo -e "${BLUE}To connect cloudflared tunnel:${NC}"
echo "  cloudflared tunnel --no-autoupdate --url http://localhost:30080"
echo ""
echo -e "${GREEN}Done!${NC}"
