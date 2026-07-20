# Contributing

This repository holds one program: a command-line validator for Agent Manifest
v1.0 declarations. It consumes the specification; it does not define it.

## Scope

Accepted:

- Defect reports with a reproducible input and the observed exit code.
- Fixes for defects in reading, parsing, validating, or reporting.
- Portability fixes (Windows, macOS, Linux; Node.js 20 and later).
- Tests that pin existing behaviour.
- Documentation corrections.

Not accepted here:

- Changes to the Agent Manifest schema or specification. Those belong in
  [agent-manifest/agent-manifest](https://github.com/agent-manifest/agent-manifest).
  The vendored schema in this repository is a byte-for-byte copy and is never
  edited locally — see [`schema/SOURCE.json`](schema/SOURCE.json).
- Scoring, ranking, certification, policy enforcement, or any interpretation of
  a manifest beyond what the schema declares. The CLI validates structure.
- Telemetry, analytics, auto-update, or any install-time script.
- New runtime dependencies without a specific, argued need. The dependency set
  is deliberately `ajv` and `ajv-formats`.
- New commands added for symmetry. `validate` is the only command; see
  [BACKLOG.md](BACKLOG.md).

## Working on a change

```bash
npm ci
npm test              # unit, contract and end-to-end tests, offline
npm run check:schema  # online: vendored schema vs the canonical published copy
npm run check:package # tarball contents, no publish
```

Requirements for a pull request:

- The test suite passes on Node.js 20, 22 and 24 (CI runs all three on Linux,
  macOS and Windows).
- A behavioural change is accompanied by a test that fails without it.
- A change to the command contract — arguments, exit codes, `--json` shape,
  which stream carries what — is documented in `README.md` and `CHANGELOG.md`
  in the same pull request. That contract is what CI consumers depend on.
- Commits are atomic and describe the change, not the process.

## Reporting a defect

Open an issue with the CLI version (`agent-manifest --version`), the Node.js
version, the operating system, the exact command, the input, and the expected
and observed output and exit code. For anything exploitable, follow
[SECURITY.md](SECURITY.md) instead.

## Licence

Contributions are accepted under the Apache License 2.0 (see
[LICENSE](LICENSE)).
