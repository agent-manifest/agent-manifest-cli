import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CliError } from './errors.js';
import { readSource, parseJson } from './io.js';

/**
 * Absolute path to the vendored copy of spec/v1.0/schema.json.
 *
 * This file is copied byte-for-byte from the frozen specification and is the
 * default, deterministic schema. It is read from disk only — never fetched.
 */
export const VENDORED_SCHEMA_PATH = fileURLToPath(
  new URL('../schema/agent-manifest-v1.0.schema.json', import.meta.url),
);

/**
 * Schema version reported for the vendored schema.
 *
 * This is the only place "1.0" may be reported. A non-vendored schema must
 * never resolve to "1.0".
 */
export const VENDORED_SCHEMA_VERSION = '1.0';

/** Load and parse the vendored default schema from local disk. */
export async function loadVendoredSchema() {
  let text;
  try {
    text = await readFile(VENDORED_SCHEMA_PATH, 'utf8');
  } catch {
    throw new CliError(2, 'Cannot read vendored schema.');
  }
  return parseJson(text, 'vendored schema');
}

/** Load and parse an alternative schema from a file path or http(s) URL. */
export async function loadAlternativeSchema(ref) {
  const text = await readSource(ref, 'schema');
  return parseJson(text, 'schema');
}

/**
 * Resolve the schema_version to report for an alternative (--schema) schema.
 *
 *   1. the schema's own `version` field, if present;
 *   2. otherwise its `$id`;
 *   3. otherwise null.
 *
 * Never returns "1.0" — that value is reserved for the vendored schema.
 *
 * @param {unknown} schema Parsed alternative schema document.
 * @returns {string|number|null}
 */
export function resolveAlternativeSchemaVersion(schema) {
  if (schema && typeof schema === 'object') {
    if ('version' in schema && schema.version != null) {
      return schema.version;
    }
    if ('$id' in schema && schema.$id != null) {
      return schema.$id;
    }
  }
  return null;
}
