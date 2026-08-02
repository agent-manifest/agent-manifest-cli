# @agent-manifest/cli

The Agent Manifest command-line interface (CLI) — the command-line validator for
[Agent Manifest](https://agent-manifest-spec.org) v1.0 declarations. Installs the
`agent-manifest` command.

`agent-manifest` reads a manifest document and checks it against the Agent
Manifest v1.0 JSON Schema. It validates structure only.

The canonical documentation page for the CLI is
<https://agent-manifest-spec.org/docs/cli/>. This repository is its source.

## Status

| | |
| --- | --- |
| Version | 0.1.1 |
| npm | [`@agent-manifest/cli`](https://www.npmjs.com/package/@agent-manifest/cli) — published |
| Command | `agent-manifest` |
| Specification | Agent Manifest v1.0 (frozen), from `@agent-manifest/schema` |
| Node.js | >= 20 (tested on 20, 22 and 24; Linux, macOS, Windows) |
| Module system | ESM |
| Commands | `validate` — the only command |
| Licence | Apache-2.0 |

## What it does

- Reads a manifest from a file path, an `http(s)` URL, or standard input.
- Validates it against the packaged Agent Manifest v1.0 JSON Schema.
- Reports each failing field with its JSON Pointer path and the validator's own
  message.
- Returns `0`, `1` or `2` so a script can distinguish "valid", "invalid" and
  "could not be checked".
- Emits a single JSON object with `--json` for machine consumption.

## What it does not do

- It does not score, rank, grade, or recommend.
- It does not certify, attest, or verify that an agent behaves as declared. A
  manifest that validates is a well-formed declaration, nothing more.
- It does not enforce anything at runtime, and it is not a policy engine.
- It does not modify, format, or write your manifest — or any other file.
- It does not define the specification. The schema is copied from the canonical
  source; this repository never edits it.
- It does not phone home: no telemetry, no analytics, no auto-update, no
  install-time script.

## Install

```bash
npm install -g @agent-manifest/cli                 # global command
npx @agent-manifest/cli validate ./manifest.json   # one-off, no install
```

### From a clone

```bash
git clone https://github.com/agent-manifest/agent-manifest-cli.git
cd agent-manifest-cli
npm ci
node ./bin/agent-manifest.js validate ./examples/minimal.json
```

To get the `agent-manifest` command on your `PATH` from that clone:

```bash
npm link          # from the clone; npm unlink -g @agent-manifest/cli to undo
agent-manifest validate ./examples/minimal.json
```

> **Naming.** The unscoped npm package `agent-manifest` and the `@agentmanifest/*`
> scope are unrelated third-party projects. Installing either will not give you
> this validator. Use the scoped name `@agent-manifest/cli`; the installed
> command is `agent-manifest`.

### Updating and removing

```bash
npm install -g @agent-manifest/cli@latest   # update
npm uninstall -g @agent-manifest/cli        # remove
```

Uninstalling removes the package and the `agent-manifest` command. Nothing else
is written to your system: the CLI creates no configuration directory, cache, or
state file.

## Quick start

Save this as `manifest.json`. It contains every required field of v1.0 and is the
same document as [`examples/minimal.json`](examples/minimal.json):

```json
{
  "manifest_version": "1.0",
  "agent_id": "example.minimal-agent",
  "agent_name": "Minimal Example Agent",
  "agent_version": "0.1.0",
  "owner": {
    "type": "organization",
    "identifier": "Example Org"
  },
  "purpose": {
    "primary_code": "support",
    "description": "Answer basic product questions for end users."
  },
  "forbidden_actions": [
    "never delete user data"
  ],
  "autonomy": {
    "level": 0
  },
  "risk_profile": {
    "level": "low"
  },
  "data_handling": {
    "stores_personal_data": false
  },
  "stopping_authority": {
    "stoppable_by": [
      "operator"
    ],
    "mechanism": "runtime disable via admin console"
  },
  "audit_surface": {
    "logging": "basic",
    "reconstructability": "partial"
  },
  "contact": {
    "email": "ops@example.com"
  }
}
```

Then:

```console
$ agent-manifest validate ./manifest.json
Valid Agent Manifest (schema 1.0): ./manifest.json
$ echo $?
0
```

Remove the `contact` block and run it again:

```console
$ agent-manifest validate ./manifest.json
Invalid Agent Manifest (schema 1.0): ./manifest.json

  /contact  must have required property 'contact'

1 error
$ echo $?
1
```

A fully populated example is in [`examples/full.json`](examples/full.json).

## Command

```
agent-manifest validate <file|url|-> [--schema <path-or-url>] [--json] [--no-color]
```

`validate` is the only command. `agent-manifest init` is deferred; see
[BACKLOG.md](BACKLOG.md).

| Argument / option | Description |
| --- | --- |
| `<file\|url\|->` | Manifest to validate: a file path, an `http(s)` URL, or `-` for standard input. |
| `--schema <path-or-url>` | Validate against an alternative schema instead of the packaged one. |
| `--json` | Emit a single machine-readable JSON object on stdout. |
| `--no-color` | Never emit ANSI colour. |
| `-h`, `--help` | Show usage. Exits `0`. |
| `-V`, `--version` | Show the CLI version. Exits `0`. |

Options may be combined. Anything that is not a recognised option and not `-` is
a positional argument; a second positional argument to `validate` is an error.

Examples:

```bash
agent-manifest validate ./manifest.json
agent-manifest validate ./manifest.json --json
cat ./manifest.json | agent-manifest validate -
agent-manifest validate https://example.com/agent-manifest.json
agent-manifest validate ./manifest.json --schema ./local-copy.schema.json
```

### Streams

| Outcome | Channel |
| --- | --- |
| Valid or invalid result (with or without `--json`) | stdout |
| Operational error, without `--json` | stderr, one line, no stack trace |
| Operational error, with `--json` | stdout, so a machine consumer reads one object on one channel |

### Colour

Colour is presentation only; no information is carried by colour alone, and the
output is complete without it. Colour is emitted only when stdout is a terminal.
Precedence, highest first: `--no-color`, then `NO_COLOR`
([no-color.org](https://no-color.org)), then `FORCE_COLOR`, then TTY detection.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Manifest is valid. Also returned by `--help` and `--version`. |
| `1` | Manifest was read and parsed but failed schema validation. |
| `2` | Validation did not complete: I/O, parse, schema-load, unreachable URL, or usage error. |

The distinction between `1` and `2` is deliberate: a network failure or a typo in
a path never masquerades as an invalid manifest.

## JSON output contract

With `--json`, exactly one JSON object is written to stdout, followed by a
newline. The `valid` field distinguishes the three outcomes:

| `valid` | Meaning | Exit code |
| --- | --- | --- |
| `true` | Manifest is valid. | `0` |
| `false` | Manifest was read and parsed but failed schema validation. | `1` |
| `null` | Validation could not be completed. | `2` |

```json
{"valid":true,"schema_version":"1.0","errors":[]}
```

```json
{"valid":false,"schema_version":"1.0","errors":[{"path":"/contact","message":"must have required property 'contact'"}]}
```

```json
{"valid":null,"schema_version":null,"errors":[{"path":"","message":"Cannot read input file: ./missing.json"}]}
```

- The object has exactly three keys: `valid`, `schema_version`, `errors`.
- Each error object has exactly `path` and `message`. No suggestions, scores, or
  extra fields are added, and messages come from the schema validator verbatim.
- For `valid: true` / `false`, `path` is a JSON Pointer to the offending
  location. For a missing required property, the property name is appended, so
  the pointer names the field that should exist. A whole-document error uses `/`.
- For `valid: null`, `errors` holds at least one object whose `path` is `""`.
- `schema_version` is `"1.0"` only for the packaged schema. With `--schema` it is
  the alternative schema's `version`, else its `$id`, else `null`.
- For `valid: null`, `schema_version` is `null` if the failure happened before the
  schema was loaded, and the resolved version if it happened afterwards.

## Use in CI

`validate` is quiet on success and non-zero on failure, so it composes directly:

```yaml
- name: Validate the agent manifest
  run: npx --yes @agent-manifest/cli validate ./agent-manifest.json
```

Validate several manifests and fail on the first invalid one:

```bash
find . -name 'agent-manifest.json' -print0 | xargs -0 -n1 agent-manifest validate
```

Machine-readable, distinguishing "invalid" from "could not be checked":

```bash
result=$(agent-manifest validate ./manifest.json --json); status=$?
case "$status" in
  0) echo "valid" ;;
  1) echo "invalid: $(printf '%s' "$result" | jq -c '.errors')" ;;
  2) echo "not checked: $(printf '%s' "$result" | jq -r '.errors[0].message')" ;;
esac
```

Colour is disabled automatically when stdout is not a terminal, so logs stay
clean; `--no-color` forces it off in a CI system that fakes a TTY.

## Relationship to Agent Manifest v1.0

The CLI does not carry its own copy of the schema. It depends on
[`@agent-manifest/schema`](https://www.npmjs.com/package/@agent-manifest/schema),
which distributes the v1.0 schema byte-for-byte from the canonical
`spec/v1.0/schema.json` in
[agent-manifest/agent-manifest](https://github.com/agent-manifest/agent-manifest),
published at <https://agent-manifest-spec.org/spec/v1.0/schema.json>. The
checking itself is done by the shared validator in
[`@agent-manifest/client`](https://www.npmjs.com/package/@agent-manifest/client),
so a manifest gets the same verdict here as it does anywhere else in the
ecosystem.

- The default schema is **never fetched over the network**. It arrives at
  install time and is read from `node_modules` on disk, so validation against it
  is deterministic: the same manifest gives the same result regardless of
  network conditions.
- Determinism refers to the schema, not to the input. `validate <url>` uses the
  network only to read the manifest; the schema is still local.
- An unreachable or unreadable input URL is an operational error (exit `2`),
  never a validation failure (exit `1`).
- `@agent-manifest/schema` records its own canonical source, sha-256 and
  synchronisation policy in the `SOURCE.json` it ships. `npm test` verifies that
  checksum offline; a scheduled repository job compares the installed schema
  against the canonical published one over the network. Depending on a package
  instead of keeping a copy does not remove the possibility of drift — it moves
  where drift would appear, and those checks follow it.
- v1.0 is frozen, so any difference is drift and is treated as an incident: the
  CLI is not pinned to a new schema package until the divergence is explained
  upstream. A future schema version arrives as an additional entry in that
  package, adopted under a new CLI minor version, never silently.

`--schema <path-or-url>` validates against a different schema. That schema is
read as given — from disk, or over the network for a URL — and the packaged
schema is not involved. `schema_version` then never reports `"1.0"`.

## Compatibility and limits

- Node.js 20 or later. No transpilation, no build step, no bundler.
- Input is read as UTF-8. A leading byte order mark is tolerated. Other
  encodings (for example UTF-16) fail as a parse error with exit `2`.
- Network reads — an input URL or `--schema <url>` — time out after 30 seconds
  and are capped at 8 MiB. Redirects are followed.
- Standard input is capped at 8 MiB.
- A very large local file fails as a read error rather than exhausting memory
  silently, and every error output is one line plus, for an invalid manifest, one
  line per failing field.
- The packaged schema is Agent Manifest v1.0 only. A manifest declaring another
  `manifest_version` fails validation against it; that is the schema's rule, not
  an extra check by the CLI.

## Security

The CLI never writes files, executes nothing from its input, and reaches the
network only for a reference you passed as a URL. There is no telemetry and no
install-time script. See [SECURITY.md](SECURITY.md) for the full statement, the
scope, and how to report a vulnerability privately.

## Reporting problems

Open an issue at
<https://github.com/agent-manifest/agent-manifest-cli/issues> with the CLI
version, the Node.js version, the operating system, the command, the input, and
the expected and observed result. For anything exploitable, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: defect reports, portability
fixes and tests are welcome; schema changes belong in the specification
repository, and scoring, certification and enforcement are out of scope by
design.

## Links

- CLI documentation (canonical): <https://agent-manifest-spec.org/docs/cli/>
- npm package: <https://www.npmjs.com/package/@agent-manifest/cli>
- Specification site: <https://agent-manifest-spec.org>
- Specification v1.0: <https://agent-manifest-spec.org/spec/v1.0/agent_manifest_v1.0.html>
- JSON Schema v1.0: <https://agent-manifest-spec.org/spec/v1.0/schema.json>
- Specification repository: <https://github.com/agent-manifest/agent-manifest>
- This repository: <https://github.com/agent-manifest/agent-manifest-cli>
- Contact (not for vulnerabilities): <https://agent-manifest-spec.org/contact/>

## Licence and author

Apache License 2.0 — see [LICENSE](LICENSE).

Hernán Alfredo Capucci — ORCID
[0009-0008-7216-3032](https://orcid.org/0009-0008-7216-3032).

To cite the specification rather than this tool, see
[CITATION.cff](CITATION.cff).
