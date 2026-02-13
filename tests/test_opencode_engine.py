"""Tests for the OpenCode engine (L4).

Covers:
- Engine creation via factory
- Engine initial state (not started)
- execute_prompt returns failure before start()
- _extract_output parsing
- _build_config defaults
- _build_env_exports logic
"""

from __future__ import annotations

import asyncio
import json
from unittest.mock import MagicMock

import pytest

from agent_runner.engine import AgentEngine, create_engine


class TestOpenCodeEngineCreation:
    """Verify OpenCodeEngine can be created via the factory."""

    def test_create_opencode_engine(self):
        engine = create_engine("opencode")
        assert engine is not None
        assert isinstance(engine, AgentEngine)

    def test_opencode_engine_name(self):
        engine = create_engine("opencode")
        assert engine.name == "OpenCode"

    def test_opencode_engine_class_name(self):
        engine = create_engine("opencode")
        assert engine.__class__.__name__ == "OpenCodeEngine"


class TestOpenCodeEngineNotStarted:
    """Engine should return failure when used before start()."""

    def test_client_is_none_initially(self):
        engine = create_engine("opencode")
        assert engine._client is None

    def test_session_id_is_none_initially(self):
        engine = create_engine("opencode")
        assert engine._session_id is None

    def test_vm_is_none_initially(self):
        engine = create_engine("opencode")
        assert engine._vm is None

    def test_backend_is_none_initially(self):
        engine = create_engine("opencode")
        assert engine._backend is None

    @pytest.mark.asyncio
    async def test_execute_prompt_before_start_returns_failure(self):
        engine = create_engine("opencode")
        success, output = await engine.execute_prompt("test prompt")
        assert success is False
        assert "not started" in output.lower()

    @pytest.mark.asyncio
    async def test_execute_prompt_structured_before_start_returns_failure(self):
        engine = create_engine("opencode")
        success, output, structured = await engine.execute_prompt_structured(
            "test prompt", schema={"type": "object"}
        )
        assert success is False
        assert "not started" in output.lower()
        assert structured is None

    @pytest.mark.asyncio
    async def test_stop_before_start_is_safe(self):
        """Calling stop() before start() should not raise."""
        engine = create_engine("opencode")
        await engine.stop()  # Should not raise
        assert engine._client is None
        assert engine._session_id is None


class TestOpenCodeExtractOutput:
    """Test the _extract_output helper directly."""

    def _engine(self):
        from agent_runner.opencode.opencode_engine import OpenCodeEngine

        return OpenCodeEngine()

    def test_extract_text_parts(self):
        engine = self._engine()
        data = {
            "parts": [
                {"type": "step-start"},
                {"type": "text", "text": "Hello world"},
                {"type": "text", "text": "More text"},
                {"type": "step-finish"},
            ]
        }
        result = engine._extract_output(data)
        assert "Hello world" in result
        assert "More text" in result

    def test_extract_tool_invocation(self):
        engine = self._engine()
        data = {
            "parts": [
                {"type": "tool-invocation", "toolName": "bash", "result": "file created"},
            ]
        }
        result = engine._extract_output(data)
        assert "bash" in result
        assert "file created" in result

    def test_extract_fallback_to_info_content(self):
        engine = self._engine()
        data = {
            "parts": [],
            "info": {"content": "fallback content here"},
        }
        result = engine._extract_output(data)
        assert result == "fallback content here"

    def test_extract_fallback_to_json_dump(self):
        engine = self._engine()
        data = {"parts": [], "info": {}}
        result = engine._extract_output(data)
        # Should return a JSON dump of the data
        parsed = json.loads(result)
        assert parsed == data

    def test_extract_empty_parts(self):
        engine = self._engine()
        data = {"some_key": "some_value"}
        result = engine._extract_output(data)
        # No parts key, no info.content — falls back to JSON
        parsed = json.loads(result)
        assert parsed == data

    def test_extract_mixed_parts(self):
        engine = self._engine()
        data = {
            "parts": [
                {"type": "reasoning", "text": "thinking..."},
                {"type": "text", "text": "The answer is 42"},
                {"type": "tool-invocation", "toolName": "read", "result": "contents"},
                {"type": "text", "text": "Done"},
            ]
        }
        result = engine._extract_output(data)
        assert "The answer is 42" in result
        assert "[read]: contents" in result
        assert "Done" in result
        # reasoning type is not extracted
        assert "thinking" not in result


class TestOpenCodeBuildConfig:
    """Test the _build_config helper."""

    def _engine(self):
        from agent_runner.opencode.opencode_engine import OpenCodeEngine

        return OpenCodeEngine()

    def test_default_model(self):
        engine = self._engine()
        settings = MagicMock()
        settings.opencode_model = ""
        config = engine._build_config(settings)
        assert config["model"] == "opencode/big-pickle"
        assert config["permission"] == "allow"

    def test_custom_model(self):
        engine = self._engine()
        settings = MagicMock()
        settings.opencode_model = "anthropic/claude-sonnet-4-20250514"
        config = engine._build_config(settings)
        assert config["model"] == "anthropic/claude-sonnet-4-20250514"

    def test_config_has_schema_key(self):
        engine = self._engine()
        settings = MagicMock()
        settings.opencode_model = ""
        config = engine._build_config(settings)
        assert "$schema" in config


class TestOpenCodeBuildEnvExports:
    """Test the _build_env_exports helper."""

    def _engine(self):
        from agent_runner.opencode.opencode_engine import OpenCodeEngine

        return OpenCodeEngine()

    def test_empty_when_no_keys(self):
        engine = self._engine()
        settings = MagicMock()
        settings.openai_api_key = ""
        settings.openai_host = ""
        settings.anthropic_api_key = ""
        settings.opencode_zen_api_key = ""
        result = engine._build_env_exports(settings)
        assert result == ""

    def test_anthropic_key_export(self):
        engine = self._engine()
        settings = MagicMock()
        settings.openai_api_key = ""
        settings.openai_host = ""
        settings.anthropic_api_key = "sk-ant-123"
        settings.opencode_zen_api_key = ""
        result = engine._build_env_exports(settings)
        assert "ANTHROPIC_API_KEY" in result
        assert result.endswith(" && ")

    def test_openrouter_key_is_unset(self):
        """OpenRouter keys should NOT be passed as OPENAI_API_KEY."""
        engine = self._engine()
        settings = MagicMock()
        settings.openai_api_key = "sk-or-v1-abc123"
        settings.openai_host = "https://openrouter.ai/api/"
        settings.anthropic_api_key = ""
        settings.opencode_zen_api_key = ""
        result = engine._build_env_exports(settings)
        assert "unset OPENAI_API_KEY" in result

    def test_real_openai_key_is_exported(self):
        """A genuine OpenAI key (not OpenRouter) should be exported."""
        engine = self._engine()
        settings = MagicMock()
        settings.openai_api_key = "sk-proj-abc123"
        settings.openai_host = ""
        settings.anthropic_api_key = ""
        settings.opencode_zen_api_key = ""
        result = engine._build_env_exports(settings)
        assert "export OPENAI_API_KEY=" in result
        assert "unset" not in result

    def test_zen_api_key_export(self):
        engine = self._engine()
        settings = MagicMock()
        settings.openai_api_key = ""
        settings.openai_host = ""
        settings.anthropic_api_key = ""
        settings.opencode_zen_api_key = "zen-key-123"
        result = engine._build_env_exports(settings)
        assert "OPENCODE_API_KEY" in result

    def test_multiple_keys_chained(self):
        engine = self._engine()
        settings = MagicMock()
        settings.openai_api_key = "sk-proj-abc"
        settings.openai_host = ""
        settings.anthropic_api_key = "sk-ant-123"
        settings.opencode_zen_api_key = "zen-123"
        result = engine._build_env_exports(settings)
        assert " && " in result
        assert "OPENAI_API_KEY" in result
        assert "ANTHROPIC_API_KEY" in result
        assert "OPENCODE_API_KEY" in result


class TestOpenCodeReadSecretShell:
    """Test the _read_secret_shell static method."""

    def test_read_secret_shell_format(self):
        from agent_runner.opencode.opencode_engine import OpenCodeEngine

        result = OpenCodeEngine._read_secret_shell("my_secret")
        assert result == "$(cat /run/secrets/my_secret 2>/dev/null)"
