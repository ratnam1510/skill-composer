# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-06

### Added
- Initial public release.
- `skill-composer install` / `uninstall` to register the orchestration skill into Claude Code, Codex, and Cursor.
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
