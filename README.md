# agent-manifest

Command-line validator for [Agent Manifest](https://agent-manifest-spec.org) v1.0 declarations.

`agent-manifest` checks a manifest document against the Agent Manifest v1.0 JSON
Schema and tells you whether it conforms. It validates structure only — it does
not score, rank, recommend, enforce, or interpret a manifest in any way.

- **Node.js:** >= 20
- **Module system:** ESM
- **License:** Apache-2.0

## Install / use

> **Naming note.** The unscoped npm package named `agent-manifest` is an
> **unrelated third-party project**. This CLI is not published to npm yet and
> will be released under this project's npm scope.

### Local (from a clone)

```bash
npm install
node ./bin/agent-manifest.js validate examples/minimal.json
```

If installed globally or linked, the `agent-manifest` binary is available
directly:

```bash
agent-manifest validate ./manifest.json
```

### npx (not yet published)

> **Do not run `npx agent-manifest`.** That command installs the unrelated
> third-party package mentioned above, not this CLI. Once this CLI is
> published under this project's npm scope, the correct `npx` invocation
> will be documented here. Until then, use the local install method above.

## Command

```
agent-manifest validate <file|url> [--schema <path-or-url>] [--json]
```

`validate` is the only command in v0.1.0.

| Option | Description |
| --- | --- |
| `--schema <path-or-url>` | Validate against an alternative schema instead of the vendored one. |
| `--json` | Emit machine-readable JSON output. |
| `-h`, `--help` | Show usage. |
| `-V`, `--version` | Show the CLI version. |

`--json` and `--schema` may be combined.

## Minimal valid manifest

A copy-paste starting point (also in [`examples/minimal.json`](examples/minimal.json)).
It contains every required field and validates against the vendored schema:

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

A fully populated example is in [`examples/full.json`](examples/full.json).

## Vendored schema and determinism

The CLI ships with a vendored copy of the Agent Manifest v1.0 schema at
[`schema/agent-manifest-v1.0.schema.json`](schema/agent-manifest-v1.0.schema.json),
copied byte-for-byte from the frozen `spec/v1.0/schema.json`.

- The default schema is **never fetched over the network.** It is read from the
  package on disk.
- Validation against the default schema is therefore **deterministic**: the same
  manifest produces the same result regardless of network conditions.
- "Deterministic" refers to the vendored schema, not to the input source. When
  you run `validate <url>`, the network is used **only** to read the input
  manifest; the schema is still the local vendored copy.
- An unreachable or unreadable input URL is an I/O error (exit code `2`), never a
  validation failure (exit code `1`).

Use `--schema <path-or-url>` to validate against a different schema. A `--schema`
URL is read over the network; the vendored schema is not involved.

## JSON output contract

With `--json`, the CLI prints a single JSON object to stdout. The `valid` field
distinguishes the three outcomes:

| `valid` | Meaning | Exit code |
| --- | --- | --- |
| `true` | Manifest is valid. | `0` |
| `false` | Manifest was read and parsed but failed schema validation. | `1` |
| `null` | Validation could not be completed (I/O, parse, schema load, unreachable input URL, or CLI usage error). | `2` |

Valid, default vendored schema:

```json
{"valid":true,"schema_version":"1.0","errors":[]}
```

Invalid, default vendored schema:

```json
{"valid":false,"schema_version":"1.0","errors":[{"path":"/field/path","message":"human-readable validation message"}]}
```

Operational error (exit code `2`):

```json
{"valid":null,"schema_version":null,"errors":[{"path":"","message":"human-readable operational error"}]}
```

- Each error object has exactly a `path` and a `message`. No suggestions, scores,
  or extra fields are added.
- For `valid: true` / `valid: false`, `path` is a JSON Pointer to the offending
  location. For `valid: null`, `errors` contains at least one object with `path`
  set to `""` and a human-readable `message`.
- With `--schema`, the shape is identical, but `schema_version` reflects the
  schema actually used:
  1. the alternative schema's `version` field, if present;
  2. otherwise its `$id`;
  3. otherwise `null`.
- `schema_version` is only ever `"1.0"` for the vendored schema.
- For `valid: null`, `schema_version` is `null` if the schema could not be loaded
  or validation never reached schema loading; if the schema was loaded but the
  input failed later, it is the resolved schema version (e.g. `"1.0"` for the
  vendored schema).

Without `--json`, the CLI prints a human-readable result to stdout for a valid or
invalid manifest, and a single-line error to stderr for an operational error.
Invalid results include the JSON path for each failing field.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Manifest is valid. |
| `1` | Manifest was read and parsed but failed schema validation. |
| `2` | I/O, parse, schema load, unreachable input URL, or CLI usage error. |

## Roadmap

- **`agent-manifest init` is deferred to v0.2.0.** It is not part of v0.1.0 and is
  not available yet. See [BACKLOG.md](BACKLOG.md).
