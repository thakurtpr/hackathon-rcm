import json
import logging
import time
from functools import lru_cache
from typing import Optional

import httpx
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    groq_api_key: str = "gsk_xxxx"
    groq_model: str = "llama-3.3-70b-versatile"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma4:31b"
    backend_base_url: str = "http://localhost:8000"
    ai_service_port: int = 8001
    ai_service_base_url: str = "http://localhost:8001"
    kafka_brokers: str = "localhost:9092"
    kafka_group_id: str = "ai-svc"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "loan-docs"
    qdrant_url: str = "http://localhost:6333"
    redis_url: str = "redis://localhost:6379"
    insightface_model: str = "buffalo_l"
    embedding_model: str = "all-MiniLM-L6-v2"
    face_match_threshold: float = 0.85
    face_match_manual_review_threshold: float = 0.70
    demo_app_id: str = "demo-rajan-001"
    demo_user_id: str = "demo-user-rajan"

    def _is_groq_key_valid(self) -> bool:
        key = self.groq_api_key
        if not key:
            return False
        if key == "gsk_xxxx" or key.startswith("gsk_xxxx"):
            return False
        if key == "YOUR_GROQ_API_KEY_FROM_CONSOLE_GROQ_COM":
            return False
        return True

    @property
    def llm_provider(self) -> str:
        if self._is_groq_key_valid():
            return "groq"
        return "ollama"

    def make_llm_call(self, prompt: str, system: str = "", max_tokens: int = 1000) -> str:
        want_json = "json" in prompt.lower() or "JSON" in prompt

        if self._is_groq_key_valid():
            # Groq is available — use it with retry
            for attempt in range(2):
                try:
                    return self._call_groq(prompt, system, max_tokens, want_json)
                except Exception as exc:
                    logger.warning("Groq attempt %d failed: %s", attempt + 1, exc)
                    if attempt == 0:
                        time.sleep(1)
            logger.error("Groq failed after 2 attempts — trying Ollama fallback")

        # Groq unavailable or failed — try Ollama
        try:
            result = self._call_ollama(prompt, system, max_tokens)
            if result:
                return result
        except Exception as exc:
            logger.warning("Ollama call failed: %s", exc)

        logger.critical(
            "All LLM providers failed. GROQ_API_KEY valid=%s. "
            "Set a real GROQ_API_KEY in the .env file.",
            self._is_groq_key_valid(),
        )
        return '{"status": "error", "message": "LLM unavailable — set GROQ_API_KEY in .env"}'

    def _call_groq(self, prompt: str, system: str, max_tokens: int, want_json: bool) -> str:
        from groq import Groq  # type: ignore
        from app.services.groq_logger import log_groq_call

        @log_groq_call
        def _groq_create(prompt: str, model: str, messages: list, max_tokens: int, want_json: bool) -> str:
            client = Groq(api_key=self.groq_api_key)
            kwargs: dict = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
            }
            if want_json:
                kwargs["response_format"] = {"type": "json_object"}
            response = client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return _groq_create(prompt, self.groq_model, messages, max_tokens, want_json)

    def _call_ollama(self, prompt: str, system: str, max_tokens: int) -> str:
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        payload = {
            "model": self.ollama_model,
            "prompt": full_prompt,
            "stream": False,
            "options": {"num_predict": max_tokens},
        }
        resp = httpx.post(
            f"{self.ollama_base_url}/api/generate",
            json=payload,
            timeout=120.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", "")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
