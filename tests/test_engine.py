"""Tests for the AgentEngine abstraction and factory."""

import pytest

from agent_runner.engine import AgentEngine, create_engine


class TestEngineFactory:
    def test_create_goose_engine(self):
        engine = create_engine("goose")
        assert engine.name == "Goose"
        assert isinstance(engine, AgentEngine)

    def test_create_copilot_engine(self):
        engine = create_engine("copilot")
        assert engine.name == "GitHub Copilot"
        assert isinstance(engine, AgentEngine)

    def test_create_unknown_engine_raises(self):
        with pytest.raises(ValueError, match="Unknown agent engine"):
            create_engine("unknown")

    def test_goose_engine_not_started(self):
        """GooseEngine should return failure if execute_prompt called before start."""
        import asyncio

        engine = create_engine("goose")
        success, output = asyncio.get_event_loop().run_until_complete(
            engine.execute_prompt("test prompt")
        )
        assert not success
        assert "not started" in output.lower()

    def test_copilot_engine_not_started(self):
        """CopilotEngine should return failure if execute_prompt called before start."""
        import asyncio

        engine = create_engine("copilot")
        success, output = asyncio.get_event_loop().run_until_complete(
            engine.execute_prompt("test prompt")
        )
        assert not success
        assert "not started" in output.lower()
