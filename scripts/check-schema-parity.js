#!/usr/bin/env node
/**
 * Online drift check for the schema this CLI validates against.
 *
 * The schema used to be a copy kept in this repository. It is now the file
 * distributed by @agent-manifest/schema, so that is what this check reads: the
 * installed dependency, compared byte-for-byte with the canonical published
 * schema and with the checksum the dependency records about itself.
 *
 * Moving to a package removes a copy; it does not remove the possibility of
 * drift, it only moves where drift would appear. This check follows it.
 *
 * This script is the only part of the repository that reaches the network as
 * part of a check, and it is never run by the CLI itself. Exit codes:
 *
 *   0  installed schema, its recorded checksum and the canonical source agree
 *   1  drift detected
 *   2  the canonical source could not be read (network, DNS, HTTP status)
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sourcePath = require.resolve('@agent-manifest/schema/package.json').replace(
  /package\.json$/,
  'SOURCE.json',
);
const schemaPath = require.resolve('@agent-manifest/schema/v1.0/schema.json');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const installed = await readFile(schemaPath);
const installedHash = sha256(installed);

if (installedHash !== source.sha256) {
  process.stderr.write(
    `The installed schema does not match the checksum @agent-manifest/schema records.\n` +
      `  recorded:  ${source.sha256}\n  installed: ${installedHash}\n`,
  );
  process.exitCode = 1;
} else {
  let res;
  try {
    res = await fetch(source.canonical_url, { signal: AbortSignal.timeout(30_000) });
  } catch {
    process.stderr.write(`Cannot reach the canonical schema: ${source.canonical_url}\n`);
    process.exitCode = 2;
  }

  if (res) {
    if (!res.ok) {
      process.stderr.write(`Canonical schema returned HTTP ${res.status}: ${source.canonical_url}\n`);
      process.exitCode = 2;
    } else {
      const canonical = Buffer.from(await res.arrayBuffer());
      const canonicalHash = sha256(canonical);
      if (canonicalHash !== installedHash) {
        process.stderr.write(
          `Schema drift: the canonical schema differs from the installed package.\n` +
            `  canonical: ${canonicalHash} (${source.canonical_url})\n` +
            `  installed: ${installedHash} (@agent-manifest/schema)\n` +
            `Agent Manifest v1.0 is frozen. Do not pin this CLI to a new schema\n` +
            `package until the divergence is explained upstream in\n` +
            `${source.canonical_repository}.\n`,
        );
        process.exitCode = 1;
      } else {
        process.stdout.write(`Schema parity confirmed (sha-256 ${installedHash}).\n`);
      }
    }
  }
}
