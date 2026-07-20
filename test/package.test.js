import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const root = new URL('../', import.meta.url);
const read = (rel) => readFile(fileURLToPath(new URL(rel, root)), 'utf8');

const pkg = JSON.parse(await read('package.json'));

test('package identity matches the ratified naming decision', () => {
  assert.equal(pkg.name, '@agent-manifest/cli');
  assert.equal(pkg.bin['agent-manifest'], 'bin/agent-manifest.js');
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.engines.node, '>=20');
});

test('the lockfile agrees with the package identity', async () => {
  const lock = JSON.parse(await read('package-lock.json'));
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].name, pkg.name);
});

test('--version reports the package version', async () => {
  const bin = fileURLToPath(new URL('bin/agent-manifest.js', root));
  const { stdout } = await execFileP(process.execPath, [bin, '--version']);
  assert.equal(stdout.trim(), pkg.version);
});

test('the CHANGELOG documents the current version', async () => {
  const changelog = await read('CHANGELOG.md');
  assert.ok(
    changelog.includes(`## ${pkg.version}`),
    `CHANGELOG.md has no section for ${pkg.version}`,
  );
});

test('no install-time or postinstall hooks are declared', () => {
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish']) {
    assert.equal(pkg.scripts[hook], undefined, `${hook} script must not exist`);
  }
});

test('the runtime dependency set is the audited one', () => {
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['ajv', 'ajv-formats']);
  assert.equal(pkg.devDependencies, undefined);
});

test('published files list carries no fixtures, backlog or internal material', () => {
  assert.deepEqual(pkg.files, ['bin', 'src', 'schema', 'CHANGELOG.md', 'README.md', 'LICENSE']);
});
