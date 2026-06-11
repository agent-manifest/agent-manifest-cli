import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileP = promisify(execFile);

const BIN = fileURLToPath(new URL('../bin/agent-manifest.js', import.meta.url));
const MINIMAL = fileURLToPath(new URL('../examples/minimal.json', import.meta.url));
const FULL = fileURLToPath(new URL('../examples/full.json', import.meta.url));

const REQUIRED_TOP_LEVEL = [
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

let workDir;
let minimalManifest;

before(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'am-cli-test-'));
  minimalManifest = JSON.parse(await readFile(MINIMAL, 'utf8'));
});

after(async () => {
  await rm(workDir, { recursive: true, force: true });
});

/** Run the CLI as a child process; returns { code, stdout, stderr }. */
async function runCli(args) {
  try {
    const { stdout, stderr } = await execFileP(process.execPath, [BIN, ...args]);
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

/** Write an object to a uniquely named temp JSON file and return its path. */
let counter = 0;
async function writeTemp(obj, name = 'manifest') {
  const file = join(workDir, `${name}-${counter++}.json`);
  await writeFile(file, JSON.stringify(obj, null, 2));
  return file;
}

// --- valid manifests ---------------------------------------------------------

test('complete valid manifest exits 0', async () => {
  const { code } = await runCli(['validate', FULL]);
  assert.equal(code, 0);
});

test('minimal valid manifest exits 0', async () => {
  const { code } = await runCli(['validate', MINIMAL]);
  assert.equal(code, 0);
});

// --- missing required top-level fields --------------------------------------

for (const field of REQUIRED_TOP_LEVEL) {
  test(`missing required top-level field "${field}" fails validation`, async () => {
    const manifest = structuredClone(minimalManifest);
    delete manifest[field];
    const file = await writeTemp(manifest, `missing-${field}`);

    const { code, stdout } = await runCli(['validate', file, '--json']);
    assert.equal(code, 1);

    const out = JSON.parse(stdout);
    assert.equal(out.valid, false);
    assert.equal(out.schema_version, '1.0');
    const hasField = out.errors.some((e) => e.path === `/${field}`);
    assert.ok(hasField, `expected an error for path /${field}, got ${stdout}`);
  });
}

// --- retention handling ------------------------------------------------------

test('freeform retention "30d" fails validation', async () => {
  const manifest = structuredClone(minimalManifest);
  manifest.data_handling = { stores_personal_data: true, retention: '30d' };
  const file = await writeTemp(manifest, 'retention-freeform');

  const { code } = await runCli(['validate', file]);
  assert.equal(code, 1);
});

test('ISO 8601 retention "P30D" passes validation', async () => {
  const manifest = structuredClone(minimalManifest);
  manifest.data_handling = { stores_personal_data: true, retention: 'P30D' };
  const file = await writeTemp(manifest, 'retention-iso');

  const { code } = await runCli(['validate', file]);
  assert.equal(code, 0);
});

test('enum retention "none" passes validation', async () => {
  const manifest = structuredClone(minimalManifest);
  manifest.data_handling = { stores_personal_data: true, retention: 'none' };
  const file = await writeTemp(manifest, 'retention-none');

  const { code } = await runCli(['validate', file]);
  assert.equal(code, 0);
});

// --- conditional rule: personal data without retention ----------------------

test('stores_personal_data=true without retention fails (conditional rule)', async () => {
  const manifest = structuredClone(minimalManifest);
  manifest.data_handling = { stores_personal_data: true };
  const file = await writeTemp(manifest, 'personal-no-retention');

  const { code, stdout } = await runCli(['validate', file, '--json']);
  assert.equal(code, 1);

  const out = JSON.parse(stdout);
  assert.equal(out.valid, false);
  const hasRetention = out.errors.some((e) => e.path === '/data_handling/retention');
  assert.ok(hasRetention, `expected /data_handling/retention error, got ${stdout}`);
});

// --- --json contract ---------------------------------------------------------

test('--json valid output matches contract exactly', async () => {
  const { code, stdout } = await runCli(['validate', MINIMAL, '--json']);
  assert.equal(code, 0);
  assert.equal(stdout.trim(), '{"valid":true,"schema_version":"1.0","errors":[]}');
});

test('--json invalid output matches the contract shape', async () => {
  const manifest = structuredClone(minimalManifest);
  delete manifest.contact;
  const file = await writeTemp(manifest, 'json-invalid');

  const { code, stdout } = await runCli(['validate', file, '--json']);
  assert.equal(code, 1);

  const out = JSON.parse(stdout);
  // Exactly three top-level keys, no extras.
  assert.deepEqual(Object.keys(out).sort(), ['errors', 'schema_version', 'valid']);
  assert.equal(out.valid, false);
  assert.equal(out.schema_version, '1.0');
  assert.ok(Array.isArray(out.errors) && out.errors.length >= 1);
  for (const e of out.errors) {
    assert.deepEqual(Object.keys(e).sort(), ['message', 'path']);
    assert.equal(typeof e.path, 'string');
    assert.equal(typeof e.message, 'string');
  }
});

// --- schema_version resolution with --schema --------------------------------

const ALT_BASE = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object' };

test('--schema with version field reports that version', async () => {
  const schemaFile = await writeTemp({ ...ALT_BASE, version: '9.9-alt' }, 'schema-version');
  const inputFile = await writeTemp({}, 'any-object');

  const { code, stdout } = await runCli(['validate', inputFile, '--schema', schemaFile, '--json']);
  assert.equal(code, 0);
  const out = JSON.parse(stdout);
  assert.equal(out.schema_version, '9.9-alt');
});

test('--schema with only $id reports the $id', async () => {
  const schemaFile = await writeTemp(
    { $schema: ALT_BASE.$schema, $id: 'https://example.com/alt-schema', type: 'object' },
    'schema-id',
  );
  const inputFile = await writeTemp({}, 'any-object');

  const { code, stdout } = await runCli(['validate', inputFile, '--schema', schemaFile, '--json']);
  assert.equal(code, 0);
  const out = JSON.parse(stdout);
  assert.equal(out.schema_version, 'https://example.com/alt-schema');
});

test('--schema with neither version nor $id reports null', async () => {
  const schemaFile = await writeTemp({ ...ALT_BASE }, 'schema-bare');
  const inputFile = await writeTemp({}, 'any-object');

  const { code, stdout } = await runCli(['validate', inputFile, '--schema', schemaFile, '--json']);
  assert.equal(code, 0);
  const out = JSON.parse(stdout);
  assert.equal(out.schema_version, null);
});

test('--schema never reports "1.0" for a non-vendored schema', async () => {
  const schemaFile = await writeTemp({ ...ALT_BASE }, 'schema-not-vendored');
  const inputFile = await writeTemp({}, 'any-object');

  const { stdout } = await runCli(['validate', inputFile, '--schema', schemaFile, '--json']);
  const out = JSON.parse(stdout);
  assert.notEqual(out.schema_version, '1.0');
});

// --- exit codes 0 / 1 / 2 ----------------------------------------------------

test('exit code 0 for a valid manifest', async () => {
  const { code } = await runCli(['validate', MINIMAL]);
  assert.equal(code, 0);
});

test('exit code 1 for a parsed-but-invalid manifest', async () => {
  const manifest = structuredClone(minimalManifest);
  delete manifest.owner;
  const file = await writeTemp(manifest, 'invalid-owner');
  const { code } = await runCli(['validate', file]);
  assert.equal(code, 1);
});

test('exit code 2 for a nonexistent file path', async () => {
  const { code } = await runCli(['validate', join(workDir, 'does-not-exist.json')]);
  assert.equal(code, 2);
});

test('exit code 2 for invalid JSON input', async () => {
  const file = join(workDir, 'broken.json');
  await writeFile(file, '{ not json');
  const { code } = await runCli(['validate', file]);
  assert.equal(code, 2);
});

test('exit code 2 for missing validate argument', async () => {
  const { code } = await runCli(['validate']);
  assert.equal(code, 2);
});

test('exit code 2 for unknown command', async () => {
  const { code } = await runCli(['frobnicate', MINIMAL]);
  assert.equal(code, 2);
});

test('exit code 2 for an unreadable schema path', async () => {
  const { code } = await runCli([
    'validate',
    MINIMAL,
    '--schema',
    join(workDir, 'no-such-schema.json'),
  ]);
  assert.equal(code, 2);
});

// --- exit-2 --json operational error shape ----------------------------------

/** Assert the exact exit-2 JSON shape; returns the parsed payload. */
function assertOperationalShape(stdout) {
  const out = JSON.parse(stdout);
  assert.deepEqual(Object.keys(out).sort(), ['errors', 'schema_version', 'valid']);
  assert.equal(out.valid, null);
  assert.ok(Array.isArray(out.errors) && out.errors.length >= 1);
  for (const e of out.errors) {
    assert.deepEqual(Object.keys(e).sort(), ['message', 'path']);
    assert.equal(e.path, '');
    assert.equal(typeof e.message, 'string');
    assert.ok(e.message.length > 0);
  }
  return out;
}

test('--json nonexistent input file emits operational shape (exit 2)', async () => {
  const { code, stdout } = await runCli([
    'validate',
    join(workDir, 'does-not-exist.json'),
    '--json',
  ]);
  assert.equal(code, 2);
  const out = assertOperationalShape(stdout);
  // Vendored schema loaded before input read → resolved version reported.
  assert.equal(out.schema_version, '1.0');
});

test('--json invalid JSON input emits operational shape (exit 2)', async () => {
  const file = join(workDir, 'broken-json.json');
  await writeFile(file, '{ not json');
  const { code, stdout } = await runCli(['validate', file, '--json']);
  assert.equal(code, 2);
  const out = assertOperationalShape(stdout);
  // Vendored schema loaded before input parsed → resolved version reported.
  assert.equal(out.schema_version, '1.0');
});

test('--json unreadable schema emits operational shape with schema_version null (exit 2)', async () => {
  const { code, stdout } = await runCli([
    'validate',
    MINIMAL,
    '--schema',
    join(workDir, 'no-such-schema.json'),
    '--json',
  ]);
  assert.equal(code, 2);
  const out = assertOperationalShape(stdout);
  // Schema never loaded → schema_version null.
  assert.equal(out.schema_version, null);
});
