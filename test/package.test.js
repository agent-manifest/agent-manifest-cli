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
  // Ajv is still what does the checking, but it is no longer this package's
  // direct dependency: it arrives under @agent-manifest/client, which is where
  // the shared validator lives. One dependency, one implementation.
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@agent-manifest/client']);
  assert.equal(pkg.devDependencies, undefined);
});

test('published files list carries no fixtures, backlog or internal material', () => {
  // No `schema` entry: there is no schema directory in this repository any
  // more. It comes from @agent-manifest/schema at install time.
  assert.deepEqual(pkg.files, ['bin', 'src', 'CHANGELOG.md', 'README.md', 'LICENSE']);
});

test('the scope is published publicly and to the public registry', () => {
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.publishConfig.registry, undefined);
});

test('every declared script still works from an installed copy', () => {
  // package.json ships in the tarball; scripts/, test/ and .github/ do not. A
  // script that names a repository-only file would fail with MODULE_NOT_FOUND
  // for anyone who installs the package, so repository tooling is invoked
  // directly instead of through npm.
  assert.deepEqual(pkg.scripts, {
    test: 'node --test',
    'check:package': 'npm pack --dry-run',
  });

  const shipped = new Set(pkg.files);
  for (const [name, command] of Object.entries(pkg.scripts)) {
    for (const token of command.split(/\s+/)) {
      if (!token.includes('/') || token.startsWith('-')) continue;
      const top = token.replace(/^\.\//, '').split('/')[0];
      assert.ok(
        shipped.has(top),
        `script "${name}" references ${token}, which is not in the published files list`,
      );
    }
  }
});
