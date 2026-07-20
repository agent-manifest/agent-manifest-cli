# Changelog

This file records every released version of `@agent-manifest/cli`. Versions
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The
Agent Manifest specification has its own version line: a CLI release never
implies a specification release.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

Nothing yet.

## 0.1.0 — 2026-07-20

First version. It establishes the command contract — arguments, exit codes,
stream separation and the `--json` shape — that later versions are expected to
keep.

### Added

- `agent-manifest validate <file|url|->` — structural validation of a manifest
  against the vendored Agent Manifest v1.0 JSON Schema.
- `--json` machine-readable output with a three-state `valid` field
  (`true` / `false` / `null`) and exit codes `0` / `1` / `2`.
- `--schema <path-or-url>` to validate against an alternative schema, with
  `schema_version` resolved from the schema's `version`, then `$id`, then `null`.
  `"1.0"` is reserved for the vendored schema.
- Reading a manifest from standard input with `-`.
- `--no-color`, in addition to the `NO_COLOR` and `FORCE_COLOR` conventions;
  colour is never emitted when stdout is not a terminal.
- `schema/SOURCE.json`, recording the canonical source and sha-256 of the
  vendored schema, and an offline parity test plus a scheduled online drift
  check in the repository.

### Notes

- The published package contains `bin`, `src`, `schema`, `README.md`,
  `CHANGELOG.md` and `LICENSE`, and nothing else. It declares no install-time
  script, emits no telemetry, writes nothing to disk, and reaches the network
  only when the manifest reference or `--schema` is an explicit `http(s)` URL.
- Repository maintenance tools live in `scripts/` and are invoked directly, not
  through npm scripts, so that every script declared in `package.json` still
  works from an installed copy.
