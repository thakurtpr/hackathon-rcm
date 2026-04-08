FROM python:3.11-slim
WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgl1 libglib2.0-0 curl \
    tesseract-ocr libtesseract-dev poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Train XGBoost model at build time
RUN python scripts/train_risk_model.py || echo "Model training deferred to runtime"

# Pre-download all ML models at build time so they are ready on first container start:
#   - SentenceTransformer (all-MiniLM-L6-v2) → ~/.cache/huggingface
#   - PaddleOCR (det + rec + cls)             → ~/.paddleocr
#   - InsightFace buffalo_l (~400MB)           → ~/.insightface
#
# WHY BUILD TIME: downloading at runtime caused containers to fail health checks
# and blocked app startup. Baking models into the image means `docker compose up`
# works on the very first run with no waiting.
#
# The docker-compose volume mount (insightface_models → /root/.insightface) seeds
# itself from the image on first run, so models survive container rebuilds too.
RUN python scripts/prewarm_models.py || echo "Model pre-warm failed — will download at runtime"

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
