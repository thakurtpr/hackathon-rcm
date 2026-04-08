import logging
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def prewarm():
    # 1. Pre-warm SentenceTransformer
    logger.info("Pre-warming SentenceTransformer (all-MiniLM-L6-v2)...")
    try:
        from sentence_transformers import SentenceTransformer
        SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("SentenceTransformer model downloaded ✓")
    except Exception as e:
        logger.warning(f"Failed to pre-warm SentenceTransformer: {e}")

    # 2. Pre-warm DeepFace SFace model (~37MB)
    logger.info("Pre-warming DeepFace SFace...")
    try:
        from deepface import DeepFace
        # Create two dummy images to trigger model download
        dummy1 = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        dummy2 = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        DeepFace.verify(
            img1_path=dummy1, img2_path=dummy2,
            model_name="SFace", detector_backend="opencv",
            enforce_detection=False,
        )
        logger.info("DeepFace SFace model downloaded ✓")
    except Exception as e:
        logger.warning(f"Failed to pre-warm DeepFace: {e}")

if __name__ == "__main__":
    prewarm()
