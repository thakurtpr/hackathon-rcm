"""Groq call logging decorator and utilities.

Wraps Groq API calls to log: timestamp, model, prompt length, response length, latency.
Writes structured entries to ai_service/logs/groq_calls.log and Python logger.
"""
import functools
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Callable

logger = logging.getLogger(__name__)

# Resolve logs directory relative to the ai_service root (two levels up from this file)
_SERVICE_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", )
)
_LOGS_DIR = os.path.join(_SERVICE_ROOT, "logs")
_LOG_FILE = os.path.join(_LOGS_DIR, "groq_calls.log")

# Ensure the directory exists at import time
os.makedirs(_LOGS_DIR, exist_ok=True)


def _write_log_entry(entry: str) -> None:
    """Append a single log line to the groq_calls.log file."""
    try:
        with open(_LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(entry + "\n")
    except OSError as exc:
        logger.warning("groq_logger: could not write to %s: %s", _LOG_FILE, exc)


def log_groq_call(func: Callable) -> Callable:
    """Decorator that wraps a function making a Groq API call.

    Captures:
    - timestamp (ISO-8601 UTC)
    - model name (extracted from kwargs or positional args when available)
    - prompt length in characters
    - response length in characters
    - latency in milliseconds

    The wrapped function must accept `prompt` as its first positional argument
    or as a keyword argument.  If the function returns a string the response
    length is measured on that string; otherwise 0 is used.
    """

    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        ts = datetime.now(timezone.utc).isoformat()

        # Best-effort prompt-length extraction
        prompt_text: str = ""
        if args:
            # Convention: first positional arg after `self` is `prompt`
            first = args[0] if not hasattr(args[0], "__self__") else (args[1] if len(args) > 1 else "")
            if isinstance(first, str):
                prompt_text = first
        if not prompt_text:
            prompt_text = kwargs.get("prompt", "")
        if not isinstance(prompt_text, str):
            prompt_text = str(prompt_text)

        # Attempt to read the model name
        model: str = kwargs.get("model", "")
        if not model and len(args) >= 2:
            candidate = args[1]
            if isinstance(candidate, str):
                model = candidate
        if not model:
            model = "unknown"

        prompt_len = len(prompt_text)
        start = time.monotonic()

        try:
            result = func(*args, **kwargs)
        except Exception as exc:
            latency_ms = (time.monotonic() - start) * 1000
            entry = (
                f"[{ts}] model={model} prompt_chars={prompt_len} "
                f"response_chars=0 latency_ms={latency_ms:.1f} ERROR={type(exc).__name__}: {exc}"
            )
            logger.info("GROQ_CALL %s", entry)
            _write_log_entry(entry)
            raise

        latency_ms = (time.monotonic() - start) * 1000
        response_len = len(result) if isinstance(result, str) else 0

        entry = (
            f"[{ts}] model={model} prompt_chars={prompt_len} "
            f"response_chars={response_len} latency_ms={latency_ms:.1f} OK"
        )
        logger.info("GROQ_CALL %s", entry)
        _write_log_entry(entry)

        return result

    return wrapper
