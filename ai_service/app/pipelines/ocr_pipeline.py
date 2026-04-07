import logging
from io import BytesIO
from statistics import mean
from typing import Callable

from PIL import Image

logger = logging.getLogger(__name__)

FIELDS_BY_DOC_TYPE = {
    "aadhaar": ["name", "dob", "gender", "aadhaar_last4", "address_state"],
    "pan": ["name", "pan_number", "dob"],
    "marksheet": ["student_name", "institution", "year", "percentage_or_cgpa", "pass_fail"],
    "income_cert": ["holder_name", "annual_income", "issuing_authority", "issue_date"],
    "bank_passbook": ["account_holder_name", "account_number_last4", "bank_name", "ifsc"],
    "semester_marksheet": ["student_name", "semester_number", "sgpa", "result", "institution", "year"],
    "selfie": [],
}


def _parse_llm_json(raw: str) -> dict:
    import json
    import re
    raw = raw.strip()
    # Strip markdown code fences if present
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    return json.loads(raw)


async def run(
    minio_path: str,
    doc_type: str,
    minio_client,
    llm_call_fn: Callable[[str], str],
) -> dict:
    try:
        raw_bytes = await minio_client.fetch_file(minio_path)

        images = []
        if ".pdf" in minio_path.lower():
            from pdf2image import convert_from_bytes  # type: ignore
            images = await __import__("asyncio").to_thread(convert_from_bytes, raw_bytes)
        else:
            images = [Image.open(BytesIO(raw_bytes)).convert("RGB")]

        import asyncio
        import numpy as np
        from paddleocr import PaddleOCR  # type: ignore

        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)

        all_texts = []
        all_confidences = []

        for img in images:
            np_img = np.array(img)
            result = await asyncio.to_thread(ocr.ocr, np_img, cls=True)
            if result and result[0]:
                for line in result[0]:
                    if line and len(line) >= 2:
                        text_info = line[1]
                        if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                            all_texts.append(str(text_info[0]))
                            all_confidences.append(float(text_info[1]))

        raw_text = " ".join(all_texts)
        avg_confidence = mean(all_confidences) if all_confidences else 0.0

        fields = FIELDS_BY_DOC_TYPE.get(doc_type, [])
        if not fields:
            return {
                "ocr_extracted": {},
                "doc_trust_score": round(avg_confidence, 4),
                "doc_authentic": avg_confidence >= 0.5,
            }

        extraction_prompt = (
            f"Extract these specific fields from this {doc_type} document. "
            f"Document text: {raw_text}. "
            f"Fields needed: {fields}. "
            f"Return ONLY JSON with exactly these keys: {fields}. "
            f"Use null for any field you cannot find."
        )

        extracted = {}
        for attempt in range(2):
            try:
                raw_resp = llm_call_fn(extraction_prompt)
                extracted = _parse_llm_json(raw_resp)
                break
            except Exception as exc:
                logger.warning("OCR LLM extraction attempt %d failed: %s", attempt + 1, exc)
                if attempt == 0:
                    continue
                extracted = {f: None for f in fields}

        completeness = len([v for v in extracted.values() if v is not None]) / len(fields) if fields else 0.0
        doc_trust_score = round(avg_confidence * 0.6 + completeness * 0.4, 4)
        doc_authentic = doc_trust_score >= 0.5

        return {
            "ocr_extracted": extracted,
            "doc_trust_score": doc_trust_score,
            "doc_authentic": doc_authentic,
        }

    except Exception as exc:
        logger.error("OCR pipeline failed for %s: %s", minio_path, exc)
        return {"ocr_extracted": {}, "doc_trust_score": 0.0, "doc_authentic": False}
