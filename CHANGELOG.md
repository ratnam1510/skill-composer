# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-05-25

### Changed
- Patch release.

## [1.0.0] - 2026-05-06

### Added
- Initial public release.
- `skill-composer install` / `uninstall` auto-detects every AI agent on the machine and registers the orchestration skill into each one. Built-in registry covers Claude Code, Codex, Cursor, Windsurf, Amp, Gemini, Cline, Continue, Aider, Roo, Qwen, and Copilot. Any custom agent declared under `agents.<name>` in `composer.config.json` is auto-detected the same way — no code changes required.
- `skill-composer agents` to list AI agents auto-detected on the machine.
- `skill-composer scan` to discover installed skills across all configured agent directories.
- `skill-composer chains` to surface manual, declared, and auto-detected chains.
- `skill-composer discover [query]` to rank loaded and locally discoverable skills.
- `skill-composer remote fetch | list | search | resolve | clear` to manage cached skills.sh skill content with a configurable TTL.
- `skill-composer graph` (text and DOT) to inspect skill relationships.
- Dynamic SKILL.md generation that injects an agent-specific Target-Aware Chain Map at install time.
- Adapters for Claude Code, Codex, Cursor, Windsurf, and a generic fallback.
- Test coverage for parser chain detection, router chain discovery, and remote cache behavior.

### Fixed
- `extractChainsTo` regex no longer captures false positives from prose like "chain them" or "skill of the day". It now requires an explicit `chains_to:`, `then_run:`, `followed_by:`, or `next_skill:` declaration on its own line.
