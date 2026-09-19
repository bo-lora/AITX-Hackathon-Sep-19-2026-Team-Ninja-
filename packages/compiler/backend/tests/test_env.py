import pytest

from workflow_compiler.env import openai_api_key, openai_model


def test_openai_api_key_reads_env(monkeypatch) -> None:
    monkeypatch.setattr("workflow_compiler.env.load_env_files", lambda: None)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    assert openai_api_key() == "sk-test"


def test_openai_api_key_missing(monkeypatch) -> None:
    monkeypatch.setattr("workflow_compiler.env.load_env_files", lambda: None)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        openai_api_key()


def test_openai_model_default(monkeypatch) -> None:
    monkeypatch.setattr("workflow_compiler.env.load_env_files", lambda: None)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    assert openai_model() == "gpt-4o"
