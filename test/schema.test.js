import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { schemaV1_0, SOURCE, SCHEMA_VERSIONS, schemaFor } from '@agent-manifest/schema';

// This file used to check a copy of the schema kept in this repository. There
// is no copy any more: the schema arrives as data from @agent-manifest/schema.
// The checks did not go away with the copy, they moved onto the dependency —
// a package can drift as easily as a file, and if it ever does, this suite is
// where it should be caught, offline, before anything is published.
const require = createRequire(import.meta.url);
const schemaPath = require.resolve('@agent-manifest/schema/v1.0/schema.json');
const schemaBytes = await readFile(schemaPath);

// The field surface of the frozen v1.0 specification. Restated here so that a
// re-vendored or hand-edited schema fails the suite offline.
const REQUIRED_V1_FIELDS = [
  'manifest_version',
  'agent_id',
  'agent_name',
  'agent_version',
  'owner',
  'purpose',
  'forbidden_actions',
  'autonomy',
  'risk_profile',
  'data_handling',
  'stopping_authority',
  'audit_surface',
  'contact',
];

test('the packaged schema matches the checksum its own SOURCE.json records', () => {
  const hash = createHash('sha256').update(schemaBytes).digest('hex');
  assert.equal(hash, SOURCE.sha256);
  assert.equal(schemaBytes.length, SOURCE.bytes);
});

test('the packaged schema is the canonical v1.0 schema, unedited', () => {
  assert.equal(schemaV1_0.$id, SOURCE.schema_id);
  assert.equal(schemaV1_0.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schemaV1_0.title, 'Agent Manifest v1.0');
});

test('the packaged schema requires exactly the frozen v1.0 field surface', () => {
  assert.deepEqual(schemaV1_0.required, REQUIRED_V1_FIELDS);
  assert.equal(schemaV1_0.properties.manifest_version.const, '1.0');
});

test('SOURCE.json points at the canonical specification repository', () => {
  assert.equal(SOURCE.canonical_repository, 'https://github.com/agent-manifest/agent-manifest');
  assert.equal(SOURCE.canonical_path, 'spec/v1.0/schema.json');
  assert.equal(SOURCE.canonical_url, 'https://agent-manifest-spec.org/spec/v1.0/schema.json');
});

test('the packaged schema file contains no CRLF line endings', () => {
  assert.equal(schemaBytes.includes(Buffer.from('\r\n')), false);
});

// The CLI validates v1.0 and reports "1.0" for it. If the dependency ever
// carries more versions, that is a decision for this CLI to make explicitly,
// under a new version of its own — not something to inherit silently.
test('the packaged dependency carries v1.0 and nothing is assumed beyond it', () => {
  assert.deepEqual(SCHEMA_VERSIONS, ['1.0']);
  assert.equal(schemaFor('1.0'), schemaV1_0);
  assert.equal(schemaFor('9.9'), null);
});
