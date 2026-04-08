#!/usr/bin/env python3
"""Diagnostic script for verifying AI service dependencies.

Checks and prints PASS/FAIL for:
  1. Groq API reachable (real call)
  2. Redis reachable (SET/GET test key)
  3. Qdrant reachable (scholarships collection has docs)
  4. MinIO reachable (list buckets)
  5. Behavioral questions endpoint returns 8 questions
  6. Fraud pipeline responds
  7. Scholarship matcher returns results (Rajan profile)

Usage:
    python scripts/verify_ai_calls.py

Set environment variables (or .env) before running:
    GROQ_API_KEY, REDIS_URL, QDRANT_URL, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY
"""
import asyncio
import os
import sys
import time

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
_NO_COLOR = not sys.stdout.isatty() or os.environ.get("NO_COLOR")


def _green(text: str) -> str:
    return text if _NO_COLOR else f"\033[32m{text}\033[0m"


def _red(text: str) -> str:
    return text if _NO_COLOR else f"\033[31m{text}\033[0m"


def _yellow(text: str) -> str:
    return text if _NO_COLOR else f"\033[33m{text}\033[0m"


# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------
_results: list[tuple[str, bool, str]] = []


def _record(name: str, passed: bool, detail: str = "") -> None:
    status = _green("PASS") if passed else _red("FAIL")
    print(f"  [{status}] {name}" + (f"  ({detail})" if detail else ""))
    _results.append((name, passed, detail))


# ---------------------------------------------------------------------------
# Settings (read from env / .env)
# ---------------------------------------------------------------------------
def _load_env() -> None:
    """Load .env from ai_service root if present."""
    env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
    if not os.path.exists(env_file):
        # Also try repo root
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_file):
        with open(env_file) as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                # Don't override already-set variables
                os.environ.setdefault(key.strip(), value.strip())


_load_env()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "gsk_xxxx")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
AI_SERVICE_BASE = os.environ.get("AI_SERVICE_BASE_URL", "http://localhost:8001")


# ---------------------------------------------------------------------------
# Check 1: Groq API
# ---------------------------------------------------------------------------
async def check_groq() -> None:
    print("\n[1] Groq API")
    placeholder = {"gsk_xxxx", "YOUR_GROQ_API_KEY", "YOUR_GROQ_API_KEY_FROM_CONSOLE_GROQ_COM"}
    if not GROQ_API_KEY or GROQ_API_KEY in placeholder or GROQ_API_KEY.startswith("gsk_xxxx"):
        _record("Groq API key present", False, "GROQ_API_KEY is missing or placeholder")
        return

    try:
        from groq import Groq  # type: ignore

        def _call() -> str:
            client = Groq(api_key=GROQ_API_KEY)
            start = time.monotonic()
            resp = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": "Say 'hello' in exactly one word."}],
                max_tokens=10,
            )
            latency = (time.monotonic() - start) * 1000
            content = resp.choices[0].message.content or ""
            return f"{content.strip()!r} in {latency:.0f}ms"

        detail = await asyncio.to_thread(_call)
        _record("Groq API reachable", True, detail)
    except Exception as exc:
        _record("Groq API reachable", False, str(exc))


# ---------------------------------------------------------------------------
# Check 2: Redis
# ---------------------------------------------------------------------------
async def check_redis() -> None:
    print("\n[2] Redis")
    try:
        import redis.asyncio as aioredis  # type: ignore

        r = aioredis.from_url(REDIS_URL, socket_connect_timeout=3)
        test_key = "verify_ai_calls:probe"
        test_val = "ok"
        await r.set(test_key, test_val, ex=10)
        result = await r.get(test_key)
        await r.aclose()
        if result and result.decode() == test_val:
            _record("Redis SET/GET", True, f"url={REDIS_URL}")
        else:
            _record("Redis SET/GET", False, f"unexpected value: {result!r}")
    except Exception as exc:
        _record("Redis SET/GET", False, str(exc))


# ---------------------------------------------------------------------------
# Check 3: Qdrant scholarships collection
# ---------------------------------------------------------------------------
async def check_qdrant() -> None:
    print("\n[3] Qdrant")
    try:
        from qdrant_client import QdrantClient  # type: ignore

        def _call() -> int:
            client = QdrantClient(url=QDRANT_URL, timeout=5)
            results = client.search(
                collection_name="scholarships",
                query_vector=[0.0] * 384,
                limit=1,
            )
            return len(results)

        count = await asyncio.to_thread(_call)
        if count > 0:
            _record("Qdrant scholarships collection has docs", True, f"url={QDRANT_URL}")
        else:
            _record("Qdrant scholarships collection has docs", False, "collection is empty")
    except Exception as exc:
        _record("Qdrant scholarships collection has docs", False, str(exc))


# ---------------------------------------------------------------------------
# Check 4: MinIO
# ---------------------------------------------------------------------------
async def check_minio() -> None:
    print("\n[4] MinIO")
    try:
        from minio import Minio  # type: ignore

        def _call() -> list:
            host_port = MINIO_ENDPOINT.split(":")
            host = host_port[0]
            port = int(host_port[1]) if len(host_port) > 1 else 9000
            client = Minio(
                f"{host}:{port}",
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=False,
            )
            return list(client.list_buckets())

        buckets = await asyncio.to_thread(_call)
        _record("MinIO list buckets", True, f"{len(buckets)} bucket(s) found")
    except Exception as exc:
        _record("MinIO list buckets", False, str(exc))


# ---------------------------------------------------------------------------
# Check 5: Behavioral questions endpoint
# ---------------------------------------------------------------------------
async def check_behavioral_questions() -> None:
    print("\n[5] Behavioral questions endpoint")
    try:
        import httpx  # type: ignore

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{AI_SERVICE_BASE}/behavioral/questions",
                params={"app_id": "test", "user_id": "test"},
            )
        if resp.status_code == 200:
            data = resp.json()
            questions = data.get("questions", [])
            if len(questions) == 8:
                _record("Behavioral questions returns 8 questions", True, f"status={resp.status_code}")
            else:
                _record(
                    "Behavioral questions returns 8 questions",
                    False,
                    f"got {len(questions)} questions (expected 8)",
                )
        else:
            _record(
                "Behavioral questions returns 8 questions",
                False,
                f"HTTP {resp.status_code}: {resp.text[:120]}",
            )
    except Exception as exc:
        _record("Behavioral questions returns 8 questions", False, str(exc))


# ---------------------------------------------------------------------------
# Check 6: Fraud pipeline
# ---------------------------------------------------------------------------
async def check_fraud_pipeline() -> None:
    print("\n[6] Fraud pipeline")
    dummy_payload = {
        "app_id": "verify-probe-001",
        "user_id": "verify-user-001",
        "pan_number": "ABCDE1234F",
        "aadhaar_number": "123456789012",
        "mobile": "9876543210",
        "doc_ids": [],
        "selfie_embedding": [],
        "ocr_income": 0,
        "profile_income": 0,
    }
    try:
        import httpx  # type: ignore

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{AI_SERVICE_BASE}/fraud/check",
                json=dummy_payload,
            )
        if resp.status_code in (200, 201):
            data = resp.json()
            _record("Fraud pipeline responds", True, f"fraud_flag={data.get('fraud_flag')}")
        else:
            _record("Fraud pipeline responds", False, f"HTTP {resp.status_code}: {resp.text[:120]}")
    except Exception as exc:
        _record("Fraud pipeline responds", False, str(exc))


# ---------------------------------------------------------------------------
# Check 7: Scholarship matcher (Rajan profile)
# ---------------------------------------------------------------------------
async def check_scholarship_matcher() -> None:
    print("\n[7] Scholarship matcher (Rajan profile)")
    rajan_payload = {
        "app_id": "demo-rajan-001",
        "user_id": "demo-user-rajan",
        "profile": {
            "full_name": "Rajan Kumar",
            "course": "B.Tech",
            "institution": "NIT Rourkela",
            "last_percentage": "72.5",
            "family_income": "1l_to_3l",
            "category": "obc",
            "current_year": "2nd",
            "loan_amount": "500000",
        },
    }
    try:
        import httpx  # type: ignore

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{AI_SERVICE_BASE}/scholarships/match",
                json=rajan_payload,
            )
        if resp.status_code == 200:
            data = resp.json()
            matched = data.get("matched_scholarships", [])
            _record(
                "Scholarship matcher returns results",
                True,
                f"{len(matched)} scholarship(s) matched",
            )
        else:
            _record(
                "Scholarship matcher returns results",
                False,
                f"HTTP {resp.status_code}: {resp.text[:120]}",
            )
    except Exception as exc:
        _record("Scholarship matcher returns results", False, str(exc))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def main() -> None:
    print("=" * 60)
    print("  Hackforge AI Service — Diagnostic Verification")
    print("=" * 60)

    await check_groq()
    await check_redis()
    await check_qdrant()
    await check_minio()
    await check_behavioral_questions()
    await check_fraud_pipeline()
    await check_scholarship_matcher()

    # Summary
    total = len(_results)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = total - passed
    pct = int(passed / total * 100) if total else 0

    print("\n" + "=" * 60)
    color_pct = _green if pct >= 80 else (_yellow if pct >= 50 else _red)
    print(f"  Overall health: {color_pct(str(pct) + '%')}  ({passed}/{total} checks passed)")

    if failed:
        print(f"\n  {_red('Failed checks:')}")
        for name, ok, detail in _results:
            if not ok:
                print(f"    - {name}: {detail}")

    print("=" * 60)
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
