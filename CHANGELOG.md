# Changelog

All notable changes to Duckling will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-02-12

### Added

- FastAPI orchestrator with REST API and WebSocket support
- Warm pool manager with Docker backend (Firecracker support planned)
- Goose-based agent runner with 9-step code pipeline
- CodeRabbit-style 9-step review pipeline with AST security scanning
- Intent classifier for automatic task mode routing (code/review/peer-review)
- Slack bot integration with slash commands and mentions
- Terminal UI (TUI) built with Bun and OpenTUI
- Tauri + SolidJS desktop GUI (experimental)
- GitHub and Bitbucket git integration
- Docker Compose setup for local development
- 70+ tests covering intent classification, models, pipeline, and engine
