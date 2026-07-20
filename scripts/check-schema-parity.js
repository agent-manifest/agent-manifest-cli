#!/usr/bin/env node
/**
 * Online drift check for the vendored schema.
 *
 * Fetches the canonical published schema and compares it byte-for-byte with the
 * vendored copy and with the checksum recorded in schema/SOURCE.json.
 *
 * This script is the only part of the repository that reaches the network as
 * part of a check, and it is never run by the CLI itself. Exit codes:
 *
 *   0  vendored copy, recorded checksum and canonical source all agree
 *   1  drift detected
 *   2  the canonical source could not be read (network, DNS, HTTP status)
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const sourcePath = fileURLToPath(new URL('schema/SOURCE.json', root));

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const vendored = await readFile(fileURLToPath(new URL(source.vendored_file, root)));
const vendoredHash = sha256(vendored);

if (vendoredHash !== source.sha256) {
  process.stderr.write(
    `Vendored schema does not match the checksum recorded in schema/SOURCE.json.\n` +
      `  recorded: ${source.sha256}\n  vendored: ${vendoredHash}\n`,
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
      if (canonicalHash !== vendoredHash) {
        process.stderr.write(
          `Schema drift: the canonical schema differs from the vendored copy.\n` +
            `  canonical: ${canonicalHash} (${source.canonical_url})\n` +
            `  vendored:  ${vendoredHash} (${source.vendored_file})\n` +
            `Agent Manifest v1.0 is frozen. Do not re-vendor until the divergence is\n` +
            `explained upstream in ${source.canonical_repository}.\n`,
        );
        process.exitCode = 1;
      } else {
        process.stdout.write(`Schema parity confirmed (sha-256 ${vendoredHash}).\n`);
      }
    }
  }
}
