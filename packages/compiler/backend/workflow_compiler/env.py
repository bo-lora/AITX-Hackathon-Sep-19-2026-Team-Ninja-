from __future__ import annotations

import os
from pathlib import Path


def load_env_files() -> None:
    """Load KEY=VALUE pairs from nearby .env files without overriding the real env."""
    here = Path(__file__).resolve()
    candidates = [
        Path.cwd() / ".env",
        here.parents[2] / ".env",  # repo root when installed from backend/
        here.parents[1] / ".env",
    ]
    seen: set[Path] = set()
    for path in candidates:
        try:
            path = path.resolve()
        except OSError:
            continue
        if path in seen or not path.is_file():
            continue
        seen.add(path)
        for raw in path.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = value


def gemini_api_key() -> str:
    load_env_files()
    for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY"):
        value = os.environ.get(name, "").strip()
        if value:
            return value
    raise RuntimeError(
        "Missing Gemini API key. Copy .env.example to .env and set GEMINI_API_KEY, "
        "or export GEMINI_API_KEY in your shell."
    )


def gemini_model() -> str:
    load_env_files()
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"


def openai_api_key() -> str:
    load_env_files()
    value = os.environ.get("OPENAI_API_KEY", "").strip()
    if value:
        return value
    raise RuntimeError(
        "Missing OpenAI API key. Copy .env.example to .env and set OPENAI_API_KEY, "
        "or export OPENAI_API_KEY in your shell."
    )


def openai_model() -> str:
    load_env_files()
    return os.environ.get("OPENAI_MODEL", "gpt-4o").strip() or "gpt-4o"
