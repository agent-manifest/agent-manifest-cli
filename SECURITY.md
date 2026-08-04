# Security policy

## What this tool does and does not do

`@agent-manifest/cli` reads a JSON document and checks its structure against the
Agent Manifest v1.0 JSON Schema, which arrives from the `@agent-manifest/schema`
package rather than from a copy kept in this repository; the checking itself is
done by the shared validator in `@agent-manifest/client`. It does not authenticate,
authorise, enforce, certify, or attest anything. A manifest that validates is a
well-formed declaration; it is not evidence that the declaring agent behaves as
declared.

Operational properties, each covered by a regression test:

- The CLI never writes files and never modifies its input.
- The default schema is read from the installed package on disk. No network
  access occurs unless the reference you pass is itself an `http(s)` URL, or you
  pass `--schema <url>`.
- Network reads are bounded: a 30-second timeout and an 8 MiB ceiling.
- There is no telemetry, no analytics, no auto-update, and no install-time
  script (`preinstall`, `install`, `postinstall`, `prepare`).
- Errors are reported as single-line messages. Stack traces are not printed.

## Reporting a vulnerability

Report privately through GitHub's Private Vulnerability Reporting for this
repository (Security → Advisories → Report a vulnerability). Do not open a
public issue for an exploitable finding.

Please include the version (`agent-manifest --version`), Node.js version,
operating system, the input needed to reproduce, and the observed and expected
behaviour.

Reports are acknowledged as capacity allows; this is a small, single-maintainer
project and no response time is promised.

## In scope

- Reading a crafted manifest, schema, or URL causes anything other than a
  bounded exit with code `0`, `1`, or `2`.
- Any file write, process execution, or network access not described above.
- Any path by which a crafted document escapes the read-only, structural
  contract described here.
- Divergence between the schema the CLI validates against and the canonical
  specification (checked by `scripts/check-schema-parity.js`, which compares the
  installed `@agent-manifest/schema` with the published canonical file).

## Out of scope

- The content or truthfulness of any manifest a third party publishes.
- The behaviour of agents that declare a manifest.
- Vulnerabilities in Node.js itself, or in a dependency, that are already
  publicly tracked upstream — report those upstream and, if the CLI is affected,
  open an issue referencing the advisory.
