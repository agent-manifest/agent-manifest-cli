import { schemaV1_0 } from '@agent-manifest/schema';
import { readSource, parseJson } from './io.js';

/**
 * The default schema, and where it comes from.
 *
 * It used to be a file in this repository, copied by hand from the frozen
 * specification and checked against a recorded checksum. It is now a
 * dependency: @agent-manifest/schema distributes the same bytes as data, from
 * the registry, with provenance. The copy that lived here is gone rather than
 * kept in sync, because a copy kept in sync is still a copy that can drift.
 *
 * The schema is still never fetched at run time. It arrives at install time
 * and is read from node_modules like any other module.
 */

/**
 * The packaged default schema: the Agent Manifest v1.0 JSON Schema.
 */
export const PACKAGED_SCHEMA = schemaV1_0;

/**
 * Schema version reported for the packaged schema.
 *
 * This is the only place "1.0" may be reported. A schema supplied with
 * --schema must never resolve to "1.0".
 */
export const PACKAGED_SCHEMA_VERSION = '1.0';

/** Return the packaged default schema. Reads nothing and fetches nothing. */
export async function loadPackagedSchema() {
  return PACKAGED_SCHEMA;
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
 * Never returns "1.0" — that value is reserved for the packaged schema.
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
