# Backlog

Work that is deliberately not in the current version. Nothing here is promised,
scheduled, or in progress.

## Deferred

- `agent-manifest init` — a scaffold command that writes a starter manifest.
  Deferred: it is the only proposed command that would write to disk, which is a
  different security posture from a read-only validator and needs its own
  contract (target path, refusal to overwrite, `--force`, exit codes) before it
  is worth adding. Not implemented and not available.
- Additional human-readable output formatting.

## Not planned

- Scoring, ranking, grading, or recommending manifests.
- Certification, attestation, or any claim about an agent's actual behaviour.
- Runtime enforcement or policy evaluation.
- Telemetry, analytics, or auto-update.

These are excluded by design, not by lack of time. The CLI validates the
structure of a declaration; interpretation and enforcement belong to other
layers.
