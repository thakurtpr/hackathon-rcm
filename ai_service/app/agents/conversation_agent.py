"""Stateful conversational loan application agent (Disha).

Stage machine: INTENT → PROFILE_COLLECTION → KYC_GUIDANCE →
               BEHAVIORAL_ASSESSMENT → AWAITING_RESULTS →
               RESULT_EXPLANATION → POST_APPROVAL
"""
import json
import logging
import re
import uuid
from datetime import date
from typing import Optional, Tuple

import httpx

from app.config import get_settings
from app.services import redis_service as _redis

logger = logging.getLogger(__name__)

# ─── Stage constants ────────────────────────────────────────────────────────
STAGE_INTENT      = "INTENT"
STAGE_PROFILE     = "PROFILE_COLLECTION"
STAGE_KYC         = "KYC_GUIDANCE"
STAGE_BEHAVIORAL  = "BEHAVIORAL_ASSESSMENT"
STAGE_AWAITING    = "AWAITING_RESULTS"
STAGE_RESULT      = "RESULT_EXPLANATION"
STAGE_POST        = "POST_APPROVAL"

CONV_TTL = 86400  # 24 hours

# ─── Disha persona base prompt ──────────────────────────────────────────────
DISHA_BASE = (
    "You are Disha, an AI loan and scholarship assistant for a student fintech platform in India. "
    "You are warm, encouraging, and supportive. You help students from all backgrounds, especially "
    "first-generation college students and students from rural areas. You believe in potential over marks. "
    "You speak simply and clearly. You never use jargon. When a student is nervous you reassure them. "
    "You always know the next step and guide the student to it."
)

# ─── Profile field definitions ───────────────────────────────────────────────
PROFILE_FIELDS_ORDER = [
    "full_name",
    "mobile",
    "dob",
    "course",
    "institution",
    "current_year",
    "last_percentage",
    "family_income",
    "loan_amount",    # conditional — only if intent includes loan
    "aadhaar",
    "pan",
    "category",
]

FIELD_QUESTIONS = {
    "full_name": "What is your full name?",
    "mobile": "What is your mobile number? (10 digits starting with 6, 7, 8, or 9)",
    "dob": "What is your date of birth? (format: DD/MM/YYYY)",
    "course": "What course are you currently studying? (e.g. B.Com, B.Tech, MBBS, MBA)",
    "institution": "Which college or university are you attending?",
    "current_year": (
        "What year are you currently in?\n"
        "1. 1st year\n"
        "2. 2nd year\n"
        "3. 3rd year\n"
        "4. 4th year\n"
        "5. 5th year"
    ),
    "last_percentage": "What percentage or CGPA did you score in your last exam? (e.g. 72.5 or 8.5)",
    "family_income": (
        "What is your approximate annual family income?\n"
        "1. Under ₹1 lakh\n"
        "2. ₹1 to 3 lakh\n"
        "3. ₹3 to 6 lakh\n"
        "4. ₹6 to 10 lakh\n"
        "5. Above ₹10 lakh"
    ),
    "loan_amount": (
        "How much loan amount are you looking for? "
        "Please mention the amount in rupees. (e.g. 3,00,000 or 3 lakhs)"
    ),
    "aadhaar": (
        "Please share your Aadhaar number (12 digits). "
        "It will be stored securely and encrypted."
    ),
    "pan": (
        "Please share your PAN card number. "
        "(format: 5 letters + 4 digits + 1 letter, e.g. ABCDE1234F)"
    ),
    "category": (
        "What is your category?\n"
        "1. General\n"
        "2. OBC\n"
        "3. SC\n"
        "4. ST\n"
        "5. EWS"
    ),
}

# ─── Status friendly messages ────────────────────────────────────────────────
STATUS_MESSAGES = {
    "kyc_pending":         "We are verifying your documents 📄 — this usually takes a few minutes.",
    "behavioral_pending":  "Your behavioral assessment is being scored. 🧠",
    "fraud_check":         "Running a quick security verification. 🔒",
    "eligibility_scoring": "Calculating your eligibility score — almost there! ⏳",
    "approved":            "Great news — your application has been approved! 🎉",
    "rejected":            "We have finished reviewing your application.",
    "human_review":        "Your application is under manual review by our team.",
}


# ─── Language detection ──────────────────────────────────────────────────────
def detect_language(text: str) -> str:
    for ch in text:
        cp = ord(ch)
        if 0x0900 <= cp <= 0x097F:
            return "hi"
        if 0x0B00 <= cp <= 0x0B7F:
            return "od"
    return "en"


# ─── Field validators ────────────────────────────────────────────────────────
def validate_mobile(value: str) -> Optional[str]:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 10 and digits[0] in "6789":
        return digits
    return None


def validate_dob(value: str) -> Optional[str]:
    """Return formatted DOB if valid and age >= 16, else None."""
    value = value.strip().replace("-", "/")
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", value)
    if not m:
        return None
    day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        dob = date(year, month, day)
    except ValueError:
        return None
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 16:
        return None
    return f"{day:02d}/{month:02d}/{year}"


def validate_aadhaar(value: str) -> Optional[str]:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 12:
        return digits
    return None


def validate_pan(value: str) -> Optional[str]:
    pan = value.strip().upper()
    if re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", pan):
        return pan
    return None


def normalize_income(value: str) -> Optional[str]:
    v = value.lower().strip()
    if v in ("1", "under 1 lakh", "under 1", "below 1 lakh", "< 1 lakh", "under ₹1 lakh"):
        return "under_1l"
    if v in ("2", "1 to 3 lakh", "1-3 lakh", "1 to 3", "1l to 3l", "₹1 to 3 lakh", "1 to 3 lakhs"):
        return "1l_to_3l"
    if v in ("3", "3 to 6 lakh", "3-6 lakh", "3 to 6", "₹3 to 6 lakh", "3 to 6 lakhs"):
        return "3l_to_6l"
    if v in ("4", "6 to 10 lakh", "6-10 lakh", "6 to 10", "₹6 to 10 lakh", "6 to 10 lakhs"):
        return "6l_to_10l"
    if v in ("5", "above 10 lakh", "above 10", "> 10 lakh", "more than 10 lakh", "above ₹10 lakh"):
        return "above_10l"
    return None


def normalize_category(value: str) -> Optional[str]:
    v = value.lower().strip()
    mapping = {
        "1": "general", "general": "general", "gen": "general",
        "2": "obc", "obc": "obc", "other backward class": "obc",
        "3": "sc", "sc": "sc", "scheduled caste": "sc",
        "4": "st", "st": "st", "scheduled tribe": "st",
        "5": "ews", "ews": "ews", "economically weaker section": "ews",
    }
    return mapping.get(v)


def normalize_year(value: str) -> Optional[str]:
    v = value.lower().strip()
    mapping = {
        "1": "1st", "1st": "1st", "first": "1st", "year 1": "1st",
        "2": "2nd", "2nd": "2nd", "second": "2nd", "year 2": "2nd",
        "3": "3rd", "3rd": "3rd", "third": "3rd", "year 3": "3rd",
        "4": "4th", "4th": "4th", "fourth": "4th", "year 4": "4th",
        "5": "5th", "5th": "5th", "fifth": "5th", "year 5": "5th",
    }
    return mapping.get(v)


def _validate_field(field: str, value: str, lang: str) -> Tuple[Optional[str], str]:
    """Return (valid_value or None, error_message)."""
    if field == "full_name":
        name = value.strip()
        if len(name) >= 2:
            return name, ""
        if lang == "hi":
            return None, "कृपया अपना पूरा नाम बताएं (कम से कम 2 अक्षर)।"
        return None, "Please enter your full name (at least 2 characters)."

    if field == "mobile":
        result = validate_mobile(value)
        if result:
            return result, ""
        if lang == "hi":
            return None, "मोबाइल नंबर 10 अंकों का होना चाहिए और 6, 7, 8 या 9 से शुरू होना चाहिए।"
        return None, "Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9."

    if field == "dob":
        result = validate_dob(value)
        if result:
            return result, ""
        if lang == "hi":
            return None, "कृपया जन्म तिथि DD/MM/YYYY प्रारूप में डालें। आयु कम से कम 16 वर्ष होनी चाहिए।"
        return None, (
            "Please enter a valid date of birth in DD/MM/YYYY format. "
            "You must be at least 16 years old."
        )

    if field == "course":
        course = value.strip()
        if len(course) >= 2:
            return course, ""
        return None, "Please enter your course name (e.g. B.Com, B.Tech, MBBS)."

    if field == "institution":
        inst = value.strip()
        if len(inst) >= 2:
            return inst, ""
        return None, "Please enter your institution name."

    if field == "current_year":
        result = normalize_year(value)
        if result:
            return result, ""
        if lang == "hi":
            return None, "कृपया 1 से 5 के बीच साल चुनें।"
        return None, "Please enter a year from 1st to 5th (you can type 1, 2, 3, 4, or 5)."

    if field == "last_percentage":
        val = value.strip().rstrip("%")
        try:
            pct = float(val)
            if 0 <= pct <= 100:
                return str(pct), ""
        except ValueError:
            pass
        return None, "Please enter a valid percentage or CGPA (e.g. 72.5 or 8.5)."

    if field == "family_income":
        result = normalize_income(value)
        if result:
            return result, ""
        if lang == "hi":
            return None, "कृपया 1 से 5 के बीच एक विकल्प चुनें।"
        return None, "Please choose one of the options (1-5) for your annual family income."

    if field == "loan_amount":
        lakh_match = re.search(r"(\d+\.?\d*)\s*lakh", value.lower())
        if lakh_match:
            amount = int(float(lakh_match.group(1)) * 100000)
            return str(amount), ""
        digits = re.sub(r"[,\s]", "", value)
        try:
            amount = int(digits)
            if amount > 0:
                return str(amount), ""
        except ValueError:
            pass
        return None, "Please enter the loan amount in rupees (e.g. 3,00,000 or 3 lakhs)."

    if field == "aadhaar":
        result = validate_aadhaar(value)
        if result:
            return result, ""
        if lang == "hi":
            return None, "आधार नंबर 12 अंकों का होना चाहिए।"
        return None, "Aadhaar number must be exactly 12 digits. Please re-enter."

    if field == "pan":
        result = validate_pan(value)
        if result:
            return result, ""
        if lang == "hi":
            return None, "PAN नंबर का प्रारूप गलत है। यह ABCDE1234F जैसा होना चाहिए।"
        return None, "PAN format is invalid. It should be 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)."

    if field == "category":
        result = normalize_category(value)
        if result:
            return result, ""
        if lang == "hi":
            return None, "कृपया 1 से 5 के बीच एक श्रेणी चुनें।"
        return None, "Please choose a valid category (1-General, 2-OBC, 3-SC, 4-ST, 5-EWS)."

    # Default: accept any non-empty string
    stripped = value.strip()
    if stripped:
        return stripped, ""
    return None, "Please provide a valid answer."


def _get_ack(field: str, value: str, lang: str) -> str:
    """Short acknowledgment after collecting a field."""
    if lang != "en":
        return "✓"
    acks = {
        "full_name":       f"Nice to meet you, {value}! ✓",
        "mobile":          "Mobile number saved. ✓",
        "dob":             "Date of birth noted. ✓",
        "course":          f"Got it — {value}. ✓",
        "institution":     f"{value} — great! ✓",
        "current_year":    f"{value} year — noted. ✓",
        "last_percentage": f"{value}% — thank you. ✓",
        "family_income":   "Income range noted. ✓",
        "loan_amount":     "Loan amount noted. ✓",
        "aadhaar":         "Aadhaar saved securely. ✓",
        "pan":             "PAN card saved. ✓",
        "category":        f"Category: {value.upper()} — noted. ✓",
    }
    return acks.get(field, "Got it. ✓")


# ─── LLM helpers ─────────────────────────────────────────────────────────────
def _call_groq_messages(messages: list, max_tokens: int = 800) -> Optional[str]:
    settings = get_settings()
    if not settings._is_groq_key_valid():
        return None
    try:
        from groq import Groq  # type: ignore
        from app.services.groq_logger import log_groq_call

        # Use model from settings (llama-3.3-70b-versatile) — configurable via GROQ_MODEL env var.
        model = settings.groq_model
        user_prompt = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
        )

        @log_groq_call
        def _groq_create(prompt: str, model: str) -> str:
            client = Groq(api_key=settings.groq_api_key)
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.4,
            )
            return response.choices[0].message.content or ""

        return _groq_create(user_prompt, model)
    except Exception as exc:
        logger.warning("Groq call failed: %s", exc)
        return None


def _call_ollama_messages(system: str, user_msg: str, max_tokens: int = 800) -> Optional[str]:
    settings = get_settings()
    try:
        prompt = f"{system}\n\nUser: {user_msg}\nAssistant:"
        resp = httpx.post(
            f"{settings.ollama_base_url}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {"num_predict": max_tokens},
            },
            timeout=120.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", "")
    except Exception as exc:
        logger.warning("Ollama call failed: %s", exc)
        return None


def call_llm(messages: list, max_tokens: int = 800) -> str:
    """Call LLM with Groq → Ollama → fallback chain."""
    result = _call_groq_messages(messages, max_tokens)
    if result:
        return result
    system = next((m["content"] for m in messages if m["role"] == "system"), DISHA_BASE)
    user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    result = _call_ollama_messages(system, user_msg, max_tokens)
    if result:
        return result
    return (
        "I am having a small technical difficulty. "
        "Please type anything to continue and I will pick up where we left off."
    )


# ─── Backend API helpers ──────────────────────────────────────────────────────
async def _api_put_profile(user_id: str, profile: dict) -> bool:
    try:
        settings = get_settings()
        base = settings.backend_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.put(
                f"{base}/users/{user_id}/profile",
                json=profile,
            )
            return resp.status_code < 400
    except Exception as exc:
        logger.warning("PUT profile failed (non-fatal): %s", exc)
        return False


async def _api_create_application(user_id: str, app_type: str) -> Optional[str]:
    try:
        settings = get_settings()
        base = settings.backend_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{base}/applications",
                json={"user_id": user_id, "type": app_type},
            )
            if resp.status_code < 400:
                data = resp.json()
                return data.get("app_id") or data.get("id")
    except Exception as exc:
        logger.warning("POST applications failed (non-fatal): %s", exc)
    return None


async def _api_submit_behavioral(app_id: str, user_id: str, answers: list) -> bool:
    try:
        payload = {
            "app_id": app_id,
            "answers": [
                {
                    "question_id": a["qid"],
                    "answer": a["answer"],
                    "time_taken_seconds": 60,
                }
                for a in answers
            ],
        }
        # Call ourselves (AI service behavioral submit)
        # FIX: Use Docker service name instead of localhost — inside Docker,
        # localhost resolves to the container's own loopback, not ai-service.
        # IDEAL: inject the base URL via settings.ai_service_base_url so it's
        # configurable per environment (Docker vs local dev vs prod).
        settings = get_settings()
        ai_base = f"http://ai-service:{settings.ai_service_port}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{ai_base}/behavioral/submit", json=payload)
            return resp.status_code < 400
    except Exception as exc:
        logger.warning("POST behavioral/submit failed (non-fatal): %s", exc)
        return False


async def _api_get_app_status(app_id: str) -> Optional[str]:
    try:
        settings = get_settings()
        base = settings.backend_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{base}/applications/{app_id}/status")
            if resp.status_code == 200:
                data = resp.json()
                return data.get("status") or data.get("phase")
    except Exception as exc:
        logger.warning("GET app status failed (non-fatal): %s", exc)
    return None


async def _api_get_eligibility(app_id: str) -> Optional[dict]:
    try:
        settings = get_settings()
        base = settings.backend_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{base}/eligibility/{app_id}")
            if resp.status_code == 200:
                return resp.json()
    except Exception as exc:
        logger.warning("GET eligibility failed (non-fatal): %s", exc)
    return None


async def _api_get_disbursal(app_id: str) -> Optional[dict]:
    try:
        settings = get_settings()
        base = settings.backend_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{base}/disbursal/{app_id}/schedule")
            if resp.status_code == 200:
                return resp.json()
    except Exception as exc:
        logger.warning("GET disbursal schedule failed (non-fatal): %s", exc)
    return None


# ─── Redis helpers ────────────────────────────────────────────────────────────
async def get_stage(conversation_id: str) -> str:
    stage = await _redis.get_str(f"conv_stage:{conversation_id}")
    return stage or STAGE_INTENT


async def set_stage(conversation_id: str, stage: str) -> None:
    await _redis.set_str(f"conv_stage:{conversation_id}", stage, ttl=CONV_TTL)


async def get_conv_data(conversation_id: str) -> dict:
    data = await _redis.get_json(f"conv_data:{conversation_id}")
    if not isinstance(data, dict):
        return {}
    return data


async def set_conv_data(conversation_id: str, data: dict) -> None:
    await _redis.set_json(f"conv_data:{conversation_id}", data, ttl=CONV_TTL)


# ─── Stage 1: INTENT ─────────────────────────────────────────────────────────
async def handle_intent(
    message: str, conversation_id: str, conv_data: dict
) -> Tuple[str, Optional[str]]:
    # Detect language on very first message
    if not conv_data.get("language"):
        conv_data["language"] = detect_language(message)

    lang = conv_data.get("language", "en")

    # First message → welcome + ask intent
    if not conv_data.get("intent_question_asked"):
        conv_data["intent_question_asked"] = True
        if lang == "hi":
            reply = (
                "नमस्ते! ScholarFlow AI में आपका स्वागत है। "
                "मैं दिशा हूँ, आपकी पर्सनल लोन और स्कॉलरशिप असिस्टेंट। 😊\n\n"
                "क्या आप **स्टूडेंट लोन**, **स्कॉलरशिप**, या **दोनों** के लिए आवेदन करना चाहते हैं?"
            )
        elif lang == "od":
            reply = (
                "ନମସ୍କାର! ScholarFlow AI ରେ ଆପଣଙ୍କୁ ସ୍ୱାଗତ। "
                "ମୁଁ ଦିଶା, ଆପଣଙ୍କ ଲୋନ ଏବଂ ଛାତ୍ରବୃତ୍ତି ସହାୟକ। 😊\n\n"
                "ଆପଣ **ଛାତ୍ର ଋଣ**, **ଛାତ୍ରବୃତ୍ତି**, ନା **ଉଭୟ** ଚାଉଁଛନ୍ତି?"
            )
        else:
            reply = (
                "Hello! Welcome to ScholarFlow AI. I'm Disha, your personal loan and scholarship guide. 😊\n\n"
                "I'm here to help you every step of the way — from application to approval.\n\n"
                "To get started: are you looking for a **student loan**, a **scholarship**, or **both**?"
            )
        return reply, None  # Stay in INTENT, wait for answer

    # Second message → parse intent answer
    msg_lower = message.lower()
    intent: Optional[str] = None

    if any(w in msg_lower for w in ["both", "दोनों", "ଉଭୟ", "loan and scholarship", "scholarship and loan"]):
        intent = "both"
    elif any(w in msg_lower for w in ["loan", "ऋण", "लोन", "ଋଣ", "lending"]):
        intent = "loan"
    elif any(w in msg_lower for w in ["scholarship", "छात्रवृत्ति", "ଛାତ୍ରବୃତ୍ତି", "fellowship", "grant"]):
        intent = "scholarship"

    if not intent:
        # LLM fallback
        system = (
            DISHA_BASE
            + "\nDetermine the student's intent. Reply with exactly one word: 'loan', 'scholarship', or 'both'."
        )
        raw = call_llm(
            [{"role": "system", "content": system}, {"role": "user", "content": message}],
            max_tokens=5,
        )
        raw_lower = raw.strip().lower()
        if "both" in raw_lower:
            intent = "both"
        elif "scholarship" in raw_lower:
            intent = "scholarship"
        elif "loan" in raw_lower:
            intent = "loan"

    if not intent:
        # Ask again
        if lang == "hi":
            return (
                "माफ करें, मुझे समझ नहीं आया। 😊\n\n"
                "क्या आप **लोन**, **स्कॉलरशिप**, या **दोनों** चाहते हैं?"
            ), None
        elif lang == "od":
            return (
                "ମୁଁ ବୁଝି ପାରିଲି ନାହିଁ। 😊\n\n"
                "ଆପଣ **ଋଣ**, **ଛାତ୍ରବୃତ୍ତି**, ନା **ଉଭୟ** ଚାଉଁଛନ୍ତି?"
            ), None
        else:
            return (
                "Sorry, I didn't quite catch that. 😊\n\n"
                "Are you looking for a **loan**, a **scholarship**, or **both**?"
            ), None

    conv_data["intent"] = intent

    if lang == "hi":
        reply = (
            f"बढ़िया! मैं आपके {intent} के आवेदन में मदद करूँगी। 🎓\n\n"
            f"पहले आपकी प्रोफाइल बनाते हैं।\n\n{FIELD_QUESTIONS['full_name']}"
        )
    elif lang == "od":
        reply = (
            f"ଭଲ! ଆପଣଙ୍କ {intent} ଆବେଦନ ପ୍ରକ୍ରିୟା ଆରମ୍ଭ କରୁଛି। 🎓\n\n"
            f"ପ୍ରଥମେ ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ ତିଆରି ହେବ।\n\n{FIELD_QUESTIONS['full_name']}"
        )
    else:
        reply = (
            f"Great! I'll help you with your **{intent}** application. 🎓\n\n"
            f"Let's build your profile first — it only takes a few minutes.\n\n"
            f"{FIELD_QUESTIONS['full_name']}"
        )

    return reply, STAGE_PROFILE


# ─── Stage 2: PROFILE_COLLECTION ─────────────────────────────────────────────
async def handle_profile_collection(
    message: str, conversation_id: str, conv_data: dict
) -> Tuple[str, Optional[str]]:
    collected: dict = conv_data.get("profile_fields") or {}
    intent = conv_data.get("intent", "both")
    lang = conv_data.get("language", "en")

    # Build ordered list of fields for this intent
    fields_to_collect = [
        f for f in PROFILE_FIELDS_ORDER
        if f != "loan_amount" or "loan" in intent or intent == "both"
    ]

    awaiting_field = conv_data.get("awaiting_field")

    if awaiting_field:
        # Validate user's answer to the previously-asked field
        valid_value, error_msg = _validate_field(awaiting_field, message, lang)
        if valid_value is None:
            return f"{error_msg}\n\n{FIELD_QUESTIONS[awaiting_field]}", None

        collected[awaiting_field] = valid_value
        conv_data["profile_fields"] = collected
        conv_data["awaiting_field"] = None

        remaining = [f for f in fields_to_collect if f not in collected]
        if not remaining:
            return await _complete_profile_collection(conversation_id, conv_data)

        next_field = remaining[0]
        conv_data["awaiting_field"] = next_field
        ack = _get_ack(awaiting_field, valid_value, lang)
        return f"{ack}\n\n{FIELD_QUESTIONS[next_field]}", None

    # First turn in PROFILE stage — validate message as first uncollected field
    field = next((f for f in fields_to_collect if f not in collected), None)
    if not field:
        return await _complete_profile_collection(conversation_id, conv_data)

    valid_value, error_msg = _validate_field(field, message, lang)
    if valid_value is None:
        conv_data["awaiting_field"] = field
        return f"{error_msg}\n\n{FIELD_QUESTIONS[field]}", None

    collected[field] = valid_value
    conv_data["profile_fields"] = collected

    remaining = [f for f in fields_to_collect if f not in collected]
    if not remaining:
        return await _complete_profile_collection(conversation_id, conv_data)

    next_field = remaining[0]
    conv_data["awaiting_field"] = next_field
    ack = _get_ack(field, valid_value, lang)
    return f"{ack}\n\n{FIELD_QUESTIONS[next_field]}", None


async def _complete_profile_collection(
    conversation_id: str, conv_data: dict
) -> Tuple[str, Optional[str]]:
    """Called when all profile fields are collected. Calls APIs, transitions to KYC."""
    profile = conv_data.get("profile_fields", {})
    user_id = conv_data.get("user_id") or f"user-{conversation_id[:8]}"
    intent = conv_data.get("intent", "both")
    lang = conv_data.get("language", "en")

    conv_data["user_id"] = user_id

    # API calls (non-fatal if backend unreachable)
    await _api_put_profile(user_id, profile)
    app_id = await _api_create_application(user_id, intent)
    if not app_id:
        app_id = f"app-{uuid.uuid4().hex[:8]}"
    conv_data["app_id"] = app_id

    name = profile.get("full_name", "")
    category = (profile.get("category") or "").upper()
    income = profile.get("family_income", "")

    # Build document checklist
    docs = [
        "1. Aadhaar card (photo or PDF)",
        "2. PAN card (photo or PDF)",
        "3. Recent passport photo or selfie (via camera)",
        "4. Latest marksheet",
        "5. Bank passbook (front page)",
    ]
    extra = len(docs)
    if income in ("under_1l", "1l_to_3l"):
        extra += 1
        docs.append(f"{extra}. Income certificate")
    if category in ("SC", "ST", "OBC", "EWS"):
        extra += 1
        docs.append(f"{extra}. Caste certificate (for {category} category)")

    docs_text = "\n".join(docs)

    if lang == "en":
        reply = (
            f"Excellent, {name}! I've saved your profile and created your application. 🎉\n"
            f"**Application ID:** {app_id}\n\n"
            "Now I need a few documents to verify your identity. "
            "Please upload these on the next screen:\n\n"
            f"{docs_text}\n\n"
            "Once you've uploaded all the documents, come back here and type **DONE** — "
            "or just let me know you're ready!"
        )
    elif lang == "hi":
        reply = (
            f"शाबाश, {name}! आपकी प्रोफाइल सेव हो गई। 🎉\n"
            f"**आवेदन ID:** {app_id}\n\n"
            "अब ये दस्तावेज़ अपलोड करें:\n\n"
            f"{docs_text}\n\n"
            "सभी अपलोड होने के बाद **DONE** टाइप करें।"
        )
    else:
        reply = (
            f"ଭଲ, {name}! ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ ସଞ୍ଚୟ ହୋଇଛି। 🎉\n"
            f"**ଆବେଦନ ID:** {app_id}\n\n"
            "ଏହି ଡକ୍ୟୁମେଣ୍ଟ ଅପଲୋଡ଼ କରନ୍ତୁ:\n\n"
            f"{docs_text}\n\n"
            "ଅପଲୋଡ଼ ଶେଷ ହେଲେ **DONE** ଟାଇପ୍ କରନ୍ତୁ।"
        )

    return reply, STAGE_KYC


# ─── Stage 3: KYC_GUIDANCE ───────────────────────────────────────────────────
async def handle_kyc_guidance(
    message: str, conversation_id: str, conv_data: dict
) -> Tuple[str, Optional[str]]:
    lang = conv_data.get("language", "en")
    msg_lower = message.lower().strip()

    done_signals = [
        "done", "uploaded", "upload", "complete", "completed",
        "yes", "ok", "okay", "submit", "submitted", "ready", "finish", "finished",
    ]

    if any(sig in msg_lower for sig in done_signals):
        conv_data["kyc_done"] = True
        name = conv_data.get("profile_fields", {}).get("full_name", "")
        user_id = conv_data.get("user_id", "")

        # ── Fetch OCR results from Redis ──────────────────────────────────────
        ocr_summary_lines = []
        for doc_type in ("aadhaar", "pan", "marksheet", "income_cert", "bank_passbook"):
            try:
                ocr_data = await _redis.get_json(f"ocr:result:{user_id}:{doc_type}")
                if ocr_data and ocr_data.get("fields"):
                    fields = ocr_data["fields"]
                    trust = ocr_data.get("doc_trust_score", 0)
                    authentic = ocr_data.get("doc_authentic", False)
                    status_icon = "✅" if authentic else "⚠️"
                    doc_label = doc_type.replace("_", " ").title()
                    ocr_summary_lines.append(f"\n**{status_icon} {doc_label}** (trust: {round(trust * 100)}%)")
                    for k, v in fields.items():
                        if v is not None:
                            ocr_summary_lines.append(f"  • {k.replace('_', ' ').title()}: {v}")
            except Exception:
                pass

        # ── Check face match status ───────────────────────────────────────────
        face_status = ""
        try:
            face_data = await _redis.get_json(f"face_match:{user_id}")
            if face_data:
                flag = face_data.get("flag", "")
                score = face_data.get("score", 0)
                if flag == "passed":
                    face_status = f"\n\n**✅ Face verification passed** (similarity: {round(score * 100)}%)"
                elif flag == "manual_review":
                    face_status = f"\n\n**⚠️ Face verification needs manual review** (similarity: {round(score * 100)}%)"
                elif flag == "failed":
                    face_status = "\n\n**❌ Face verification failed** — please re-upload a clear selfie."
        except Exception:
            pass

        ocr_block = "\n".join(ocr_summary_lines) if ocr_summary_lines else ""
        if ocr_block:
            ocr_block = "\n\n**Here's what we extracted from your documents:**" + ocr_block

        if lang == "en":
            reply = (
                f"Great, {name}! Your documents have been received. 📋"
                f"{ocr_block}"
                f"{face_status}\n\n"
                "Now, I want to understand you better as a person — because **your potential "
                "matters to us just as much as your marks**. 🌟\n\n"
                "I'll ask you **8 questions**. Take your time and answer honestly — "
                "there are no right or wrong answers here.\n\n"
                "Are you ready to begin? (Type **Yes** to start)"
            )
        elif lang == "hi":
            reply = (
                f"बढ़िया! आपके दस्तावेज़ मिल गए। 📋"
                f"{ocr_block}"
                f"{face_status}\n\n"
                "अब मैं आपसे 8 सवाल पूछूँगी — ईमानदारी से जवाब दें।\n\n"
                "क्या आप तैयार हैं? (**हाँ** टाइप करें)"
            )
        else:
            reply = (
                f"ଭଲ! ଆପଣଙ୍କ ଡକ୍ୟୁମେଣ୍ଟ ମିଳିଲା। 📋"
                f"{ocr_block}"
                f"{face_status}\n\n"
                "ଏବେ ମୁଁ ଆପଣଙ୍କୁ ୮ ଟି ପ୍ରଶ୍ନ ପଚାରିବି।\n\n"
                "ପ୍ରସ୍ତୁତ? (**ହଁ** ଟାଇପ୍ କରନ୍ତୁ)"
            )
        return reply, STAGE_BEHAVIORAL

    if lang == "hi":
        return "ठीक है! जब तैयार हों, **DONE** टाइप करें। 😊", None
    elif lang == "od":
        return "ଠିକ ଅଛି! ପ୍ରସ୍ତୁତ ହେଲେ **DONE** ଟାଇପ୍ କରନ୍ତୁ। 😊", None
    return (
        "No worries! Take your time to upload the documents. "
        "When you're ready, type **DONE** and we'll move to the next step. 😊"
    ), None


# ─── Stage 4: BEHAVIORAL_ASSESSMENT ──────────────────────────────────────────
def _format_question(q: dict, num: int, total: int, lang: str) -> str:
    q_text = q.get("question_text", "")
    q_type = q.get("type", "free_text")
    options = q.get("options") or []

    header = f"**Question {num} of {total}:**" if lang == "en" else f"**{num}/{total}:**"
    result = f"{header}\n\n{q_text}"

    if q_type == "mcq" and options:
        result += "\n"
        for i, opt in enumerate(options):
            result += f"\n{i + 1}. {opt}"
        result += "\n\n_(Type 1, 2, 3, or 4 to choose your answer)_"

    return result


async def handle_behavioral_assessment(
    message: str, conversation_id: str, conv_data: dict
) -> Tuple[str, Optional[str]]:
    app_id = conv_data.get("app_id", "")
    user_id = conv_data.get("user_id", "")
    lang = conv_data.get("language", "en")

    if not conv_data.get("behavioral_started"):
        # Waiting for user to say "yes" to start
        msg_lower = message.lower().strip()
        ready_signals = [
            "yes", "ready", "ok", "okay", "start", "begin", "sure",
            "go", "go ahead", "yeah", "yep", "हाँ", "हां", "ह", "ହଁ", "ha",
        ]
        if not any(sig in msg_lower for sig in ready_signals):
            if lang == "en":
                return "Please type **Yes** when you're ready to begin the assessment. 😊", None
            return "Please type Yes when ready.", None

        # Fetch questions
        questions = await _redis.get_json(f"questions:{app_id}")
        if not isinstance(questions, list) or not questions:
            questions = await _fetch_or_generate_questions(app_id, user_id, conv_data)

        if not isinstance(questions, list) or not questions:
            from app.pipelines.behavioral_pipeline import _fallback_questions
            questions = _fallback_questions()

        await _redis.set_json(f"questions:{app_id}", questions, ttl=3600)
        conv_data["questions"] = questions
        conv_data["current_question_index"] = 0
        conv_data["behavioral_answers"] = []
        conv_data["behavioral_started"] = True

        intro = ""
        if lang == "en":
            intro = (
                "Wonderful! Let's begin. 🌟 "
                "Remember — there are no right or wrong answers. "
                "Just be honest and take your time.\n\n"
            )
        return intro + _format_question(questions[0], 1, len(questions), lang), None

    # Process answer to current question
    questions = conv_data.get("questions") or []
    idx = conv_data.get("current_question_index", 0)
    answers = conv_data.get("behavioral_answers") or []

    if idx >= len(questions) or not questions:
        return await _submit_behavioral(conversation_id, conv_data)

    current_q = questions[idx]
    q_type = current_q.get("type", "free_text")

    if q_type == "mcq":
        options = current_q.get("options") or []
        valid_idx = None
        msg_stripped = message.strip()
        if msg_stripped in ("1", "2", "3", "4"):
            valid_idx = int(msg_stripped) - 1
        elif msg_stripped in ("0", "1", "2", "3"):
            valid_idx = int(msg_stripped)
        else:
            for i, opt in enumerate(options):
                if msg_stripped.lower() in opt.lower() or opt.lower() in msg_stripped.lower():
                    valid_idx = i
                    break

        if valid_idx is None or not (0 <= valid_idx <= 3):
            err = (
                "Please enter a number from **1 to 4** to choose your answer.\n\n"
                if lang == "en"
                else "कृपया 1 से 4 के बीच संख्या चुनें।\n\n"
            )
            return err + _format_question(current_q, idx + 1, len(questions), lang), None
        answer_value = str(valid_idx)

    else:
        # Free text — minimum 20 words
        words = message.strip().split()
        if len(words) < 20:
            if lang == "en":
                return (
                    "Could you tell me a bit more about that? 😊 "
                    "I'd love to understand your thoughts better. "
                    "(Please write at least 3–4 sentences)"
                ), None
            elif lang == "hi":
                return "क्या आप थोड़ा और बता सकते हैं? कम से कम 3–4 वाक्य लिखें।", None
            else:
                return "ଆଉ ଟିକିଏ ବିସ୍ତାର ରେ ଲେଖନ୍ତୁ। (୩–୪ ଧାଡ଼ି)", None
        answer_value = message.strip()

    answers.append({"qid": current_q["question_id"], "answer": answer_value})
    conv_data["behavioral_answers"] = answers
    conv_data["current_question_index"] = idx + 1

    if idx + 1 >= len(questions):
        return await _submit_behavioral(conversation_id, conv_data)

    next_q = questions[idx + 1]
    ack = "Great response! 👍\n\n" if lang == "en" else "\n"
    return ack + _format_question(next_q, idx + 2, len(questions), lang), None


async def _fetch_or_generate_questions(app_id: str, user_id: str, conv_data: dict) -> list:
    """Fetch from behavioral API or generate via pipeline."""
    try:
        settings = get_settings()
        # Use ai_service_base_url from config (defaults to localhost:8001 for local dev,
        # override to http://ai-service:8001 via env var when running inside Docker)
        ai_base = settings.ai_service_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{ai_base}/behavioral/questions",
                params={"app_id": app_id, "user_id": user_id},
            )
            if resp.status_code == 200:
                data = resp.json()
                qs = data.get("questions", [])
                if qs:
                    return qs
    except Exception:
        pass

    # Generate via pipeline using collected profile
    try:
        from app.pipelines import behavioral_pipeline
        profile = conv_data.get("profile_fields", {})
        settings = get_settings()
        return await behavioral_pipeline.generate_questions(
            profile, app_id, _redis,
            lambda prompt: settings.make_llm_call(prompt, max_tokens=2000),
        )
    except Exception as exc:
        logger.warning("generate_questions failed: %s", exc)
        return []


async def _submit_behavioral(
    conversation_id: str, conv_data: dict
) -> Tuple[str, Optional[str]]:
    app_id = conv_data.get("app_id", "")
    user_id = conv_data.get("user_id", "")
    answers = conv_data.get("behavioral_answers") or []
    lang = conv_data.get("language", "en")
    name = conv_data.get("profile_fields", {}).get("full_name", "")

    await _api_submit_behavioral(app_id, user_id, answers)

    if lang == "en":
        reply = (
            f"Thank you so much for sharing that, {name}! 🌟\n\n"
            "Your responses reflect a lot about your potential and character. "
            "We are now evaluating your complete profile — academic scores, documents, and your assessment.\n\n"
            "I'll keep you updated on the status. "
            "You can type anything here to check the latest update on your application!"
        )
    elif lang == "hi":
        reply = (
            f"बहुत-बहुत धन्यवाद, {name}! 🌟\n\n"
            "आपके जवाब आपकी क्षमता को दर्शाते हैं। "
            "हम अब आपकी पूरी प्रोफाइल का मूल्यांकन कर रहे हैं।\n\n"
            "अपडेट पाने के लिए कुछ भी टाइप करें।"
        )
    else:
        reply = (
            f"ଧନ୍ୟବାଦ, {name}! 🌟\n\n"
            "ଆପଣଙ୍କ ଉତ୍ତରଗୁଡ଼ିକ ଆପଣଙ୍କ ସଂଭାବନା ଦର୍ଶାଏ। "
            "ଆମେ ଏବେ ଆପଣଙ୍କ ସମ୍ପୂର୍ଣ ପ୍ରୋଫାଇଲ ମୂଲ୍ୟାଙ୍କନ କରୁଛୁ।\n\n"
            "ଅଦ୍ୟତନ ଜାଣିବା ପାଇଁ ଯେ କୌଣସି ଟାଇପ୍ କରନ୍ତୁ।"
        )

    return reply, STAGE_AWAITING


# ─── Stage 5: AWAITING_RESULTS ───────────────────────────────────────────────
async def handle_awaiting_results(
    message: str, conversation_id: str, conv_data: dict
) -> Tuple[str, Optional[str]]:
    app_id = conv_data.get("app_id", "")
    lang = conv_data.get("language", "en")

    status = await _api_get_app_status(app_id)

    if status in ("approved", "rejected", "human_review"):
        return await _build_result_message(conversation_id, conv_data, status)

    msg = STATUS_MESSAGES.get(status, "Your application is being processed. We'll have an update soon! ⏳")
    if lang == "en":
        reply = f"{msg}\n\nFeel free to check back anytime by sending me a message. 😊"
    else:
        reply = msg

    return reply, None


# ─── Stage 6: RESULT_EXPLANATION ─────────────────────────────────────────────
async def handle_result_explanation(
    message: str, conversation_id: str, conv_data: dict
) -> Tuple[str, Optional[str]]:
    # Result was already delivered when transitioning here; move to POST_APPROVAL
    return await handle_post_approval(message, conversation_id, conv_data)


async def _build_result_message(
    conversation_id: str, conv_data: dict, status: str
) -> Tuple[str, Optional[str]]:
    app_id = conv_data.get("app_id", "")
    lang = conv_data.get("language", "en")
    name = conv_data.get("profile_fields", {}).get("full_name", "there")

    eligibility = await _api_get_eligibility(app_id) or {}

    if status == "approved":
        reply = _build_approval_message(name, eligibility, lang)
    elif status == "human_review":
        reply = _build_human_review_message(name, lang)
    else:
        reply = _build_rejection_message(name, eligibility, lang)

    return reply, STAGE_RESULT


def _build_approval_message(name: str, eligibility: dict, lang: str) -> str:
    amount = eligibility.get("approved_amount", "N/A")
    rate = eligibility.get("interest_rate", "N/A")
    scores = eligibility.get("score_breakdown") or {}
    pq_override = eligibility.get("pq_override_applied", False)
    pq_score = eligibility.get("pq_score", 0)
    scholarships = eligibility.get("matched_scholarships") or []

    score_table = (
        "\n| Category | Score |\n"
        "|----------|-------|\n"
        f"| Academic | {scores.get('academic', 'N/A')} |\n"
        f"| Financial | {scores.get('financial', 'N/A')} |\n"
        f"| Potential (PQ) | {scores.get('potential', pq_score)} |\n"
        f"| Document Trust | {scores.get('document', 'N/A')} |\n"
        f"| KYC | {scores.get('kyc', 'N/A')} |\n"
    )

    pq_msg = ""
    if pq_override:
        pq_msg = (
            f"\n\n⭐ **The Backbencher Entrepreneur Advantage!**\n"
            f"Your strong Potential Score of **{pq_score}/100** made the difference. "
            "Your drive and clarity showed us you have what it takes. 💪"
        )

    scholarship_text = ""
    if scholarships:
        scholarship_text = "\n\n🎓 **Matched Scholarships:**\n"
        for s in scholarships[:3]:
            scholarship_text += f"• {s.get('name', '')} — ₹{s.get('amount', '')} — {s.get('reason', '')}\n"

    return (
        f"🎉 **Congratulations, {name}!**\n\n"
        f"Your application has been **approved!**\n\n"
        f"💰 **Approved Amount:** ₹{amount}\n"
        f"📊 **Interest Rate:** {rate}% per annum\n"
        f"\n**Score Breakdown:**{score_table}"
        f"{pq_msg}"
        f"{scholarship_text}\n\n"
        "📅 **Loan Disbursement:**\n"
        "Your loan will be released **semester by semester**. "
        "At the start of each semester, upload your latest marksheet and the next payment "
        "will be released within 2 working days.\n\n"
        "Type any question to learn more about EMIs, repayment, or your scholarship status!"
    )


def _build_rejection_message(name: str, eligibility: dict, lang: str) -> str:
    hints = eligibility.get("improvement_hints") or [
        "Improve your academic performance in the next semester",
        "Consider a co-applicant with a stable income",
        "Provide additional supporting documents",
    ]
    scholarships = eligibility.get("matched_scholarships") or []

    hints_text = "\n".join(f"{i + 1}. {h}" for i, h in enumerate(hints[:5]))
    scholarship_text = ""
    if scholarships:
        scholarship_text = "\n\n🎓 **Good news — you still qualify for these scholarships:**\n"
        for s in scholarships[:3]:
            scholarship_text += f"• {s.get('name', '')} — ₹{s.get('amount', '')}\n"

    return (
        f"Dear {name}, we have carefully reviewed your application. 💙\n\n"
        "Your application needs a bit more work at this time — but this is **not** the end of your journey!\n\n"
        "**Here's what you can do to strengthen your application:**\n"
        f"{hints_text}\n\n"
        "You can **reapply in 90 days** with these improvements.\n"
        f"{scholarship_text}\n\n"
        f"I believe in your potential, {name}. Keep going! 💪"
    )


def _build_human_review_message(name: str, lang: str) -> str:
    return (
        f"Hello {name}! Your application is currently under **manual review** by our team. 👤\n\n"
        "Our loan specialists are carefully evaluating your profile. "
        "You will receive a decision within **2–3 working days**.\n\n"
        "Feel free to ask me any questions in the meantime!"
    )


# ─── Stage 7: POST_APPROVAL ───────────────────────────────────────────────────
async def handle_post_approval(
    message: str, conversation_id: str, conv_data: dict
) -> Tuple[str, Optional[str]]:
    app_id = conv_data.get("app_id", "")
    profile = conv_data.get("profile_fields") or {}
    lang = conv_data.get("language", "en")
    name = profile.get("full_name", "")

    msg_lower = message.lower()

    # Disbursal schedule
    if any(w in msg_lower for w in ["disbursal", "disbursement", "payment schedule", "release schedule"]):
        schedule = await _api_get_disbursal(app_id)
        if schedule:
            if lang == "en":
                return (
                    f"Here is your disbursement schedule, {name}:\n\n"
                    f"```\n{json.dumps(schedule, indent=2)}\n```\n\n"
                    "Any other questions?"
                ), None
        if lang == "en":
            return "Your disbursement schedule will be available once your loan is fully processed. 😊", None

    # Status check
    if any(w in msg_lower for w in ["status", "update", "progress", "स्थिति"]):
        status = await _api_get_app_status(app_id)
        if status:
            friendly = STATUS_MESSAGES.get(status, status)
            return f"**Application Status:** {friendly}\n\nAny other questions?", None

    # General RAG-powered response
    context_str = (
        f"Student: {name}, Course: {profile.get('course', '')}, "
        f"Institution: {profile.get('institution', '')}, "
        f"App ID: {app_id}, Category: {profile.get('category', '').upper()}, "
        f"Income band: {profile.get('family_income', '')}"
    )

    system = (
        DISHA_BASE
        + f"\n\nYou are in POST_APPROVAL mode. Student context: {context_str}\n\n"
        "Answer questions about EMI calculation, scholarship status, semester gate process, "
        "and repayment schedule. Be specific and helpful."
    )

    if lang == "hi":
        system += "\nहिंदी में जवाब दें।"
    elif lang == "od":
        system += "\nଓଡ଼ିଆ ରେ ଉତ୍ତର ଦିଅ।"

    reply = call_llm(
        [{"role": "system", "content": system}, {"role": "user", "content": message}]
    )
    return reply, None


# ─── Main entry point ─────────────────────────────────────────────────────────
async def process_message(
    message: str,
    conversation_id: str,
    user_id: Optional[str] = None,
    embedder=None,
    qdrant_service=None,
) -> Tuple[str, str]:
    """
    Process a chat message through the stage machine.
    Returns (reply_text, current_stage_after_processing).

    Separation of concerns:
    - This agent handles conversational onboarding ONLY for users who arrive
      via the AI chat widget (/chat page or ChatWidget).
    - The frontend /onboarding wizard (frontend/app/onboarding/page.tsx) is the
      primary structured data-collection path. If a user completes the wizard,
      the wizard calls this endpoint with a synthetic message to sync state to
      KYC_GUIDANCE stage so the two channels stay consistent.
    - This agent must NOT be used to re-collect data the wizard already gathered.
    """
    stage = await get_stage(conversation_id)
    conv_data = await get_conv_data(conversation_id)

    if user_id and not conv_data.get("user_id"):
        conv_data["user_id"] = user_id

    new_stage: Optional[str] = None
    try:
        if stage == STAGE_INTENT:
            reply, new_stage = await handle_intent(message, conversation_id, conv_data)
        elif stage == STAGE_PROFILE:
            reply, new_stage = await handle_profile_collection(message, conversation_id, conv_data)
        elif stage == STAGE_KYC:
            reply, new_stage = await handle_kyc_guidance(message, conversation_id, conv_data)
        elif stage == STAGE_BEHAVIORAL:
            reply, new_stage = await handle_behavioral_assessment(message, conversation_id, conv_data)
        elif stage == STAGE_AWAITING:
            reply, new_stage = await handle_awaiting_results(message, conversation_id, conv_data)
        elif stage == STAGE_RESULT:
            reply, new_stage = await handle_result_explanation(message, conversation_id, conv_data)
            if new_stage is None:
                new_stage = STAGE_POST
        elif stage == STAGE_POST:
            reply, new_stage = await handle_post_approval(message, conversation_id, conv_data)
        else:
            # Unknown stage → restart from INTENT
            conv_data = {}
            reply, new_stage = await handle_intent(message, conversation_id, conv_data)

    except Exception as exc:
        logger.error("Stage handler error (stage=%s): %s", stage, exc, exc_info=True)
        reply = (
            "I am having a small technical difficulty. "
            "Please type anything to continue and I will pick up where we left off."
        )
        new_stage = None

    # Persist state
    await set_conv_data(conversation_id, conv_data)

    if new_stage and new_stage != stage:
        logger.info(
            "STAGE TRANSITION: %s -> %s for conv %s",
            stage, new_stage, conversation_id,
        )
        await set_stage(conversation_id, new_stage)
        stage = new_stage

    return reply, stage
