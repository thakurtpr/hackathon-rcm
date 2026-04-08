import logging
import os
import numpy as np
from sentence_transformers import SentenceTransformer
from paddleocr import PaddleOCR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def prewarm():
    # 1. Pre-warm SentenceTransformer
    logger.info("Pre-warming SentenceTransformer (all-MiniLM-L6-v2)...")
    try:
        SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("SentenceTransformer model downloaded ✓")
    except Exception as e:
        logger.warning(f"Failed to pre-warm SentenceTransformer: {e}")

    # 2. Pre-warm PaddleOCR
    logger.info("Pre-warming PaddleOCR...")
    try:
        # This will trigger download of detection, recognition and classification models
        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        # Run a dummy inference to ensure everything is downloaded
        dummy_img = np.zeros((100, 300, 3), dtype=np.uint8)
        ocr.ocr(dummy_img, cls=True)
        logger.info("PaddleOCR models downloaded ✓")
    except Exception as e:
        logger.warning(f"Failed to pre-warm PaddleOCR: {e}")

    # 3. Pre-warm InsightFace
    logger.info("Pre-warming InsightFace (buffalo_l)...")
    try:
        from insightface.app import FaceAnalysis
        app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("InsightFace models downloaded ✓")
    except Exception as e:
        logger.warning(f"Failed to pre-warm InsightFace: {e}")

if __name__ == "__main__":
    prewarm()
