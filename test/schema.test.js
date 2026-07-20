import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = (rel) => readFile(fileURLToPath(new URL(rel, root)));

const source = JSON.parse(await read('schema/SOURCE.json'));
const vendored = await read(source.vendored_file);

// The field surface of the frozen v1.0 specification. Restated here so that a
// silently re-vendored or hand-edited schema fails the suite offline.
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

test('vendored schema matches the checksum recorded in schema/SOURCE.json', () => {
  const hash = createHash('sha256').update(vendored).digest('hex');
  assert.equal(hash, source.sha256);
  assert.equal(vendored.length, source.bytes);
});

test('vendored schema declares the canonical $id and no local rewriting', () => {
  const doc = JSON.parse(vendored.toString('utf8'));
  assert.equal(doc.$id, source.schema_id);
  assert.equal(doc.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(doc.title, 'Agent Manifest v1.0');
});

test('vendored schema requires exactly the frozen v1.0 field surface', () => {
  const doc = JSON.parse(vendored.toString('utf8'));
  assert.deepEqual(doc.required, REQUIRED_V1_FIELDS);
  assert.equal(doc.properties.manifest_version.const, '1.0');
});

test('SOURCE.json points at the canonical specification repository', () => {
  assert.equal(source.canonical_repository, 'https://github.com/agent-manifest/agent-manifest');
  assert.equal(source.canonical_path, 'spec/v1.0/schema.json');
  assert.equal(source.canonical_url, 'https://agent-manifest-spec.org/spec/v1.0/schema.json');
});
