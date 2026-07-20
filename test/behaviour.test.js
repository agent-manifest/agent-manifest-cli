import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileP = promisify(execFile);

const BIN = fileURLToPath(new URL('../bin/agent-manifest.js', import.meta.url));
const MINIMAL = fileURLToPath(new URL('../examples/minimal.json', import.meta.url));

let workDir;
let minimalText;

before(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'am-cli-behaviour-'));
  minimalText = await readFile(MINIMAL, 'utf8');
});

after(async () => {
  await rm(workDir, { recursive: true, force: true });
});

/** Run the CLI as a child process, optionally feeding stdin and env. */
function runCli(args, { input, env } = {}) {
  return new Promise((resolve) => {
    const childEnv = { ...process.env, ...env };
    for (const key of ['NO_COLOR', 'FORCE_COLOR']) {
      if (!(env && key in env)) delete childEnv[key];
    }
    const child = spawn(process.execPath, [BIN, ...args], { env: childEnv });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

// --- standard input ----------------------------------------------------------

test('"-" validates a manifest read from standard input', async () => {
  const { code, stdout } = await runCli(['validate', '-'], { input: minimalText });
  assert.equal(code, 0);
  assert.match(stdout, /standard input/);
});

test('"-" with --json emits the machine-readable contract', async () => {
  const { code, stdout } = await runCli(['validate', '-', '--json'], { input: minimalText });
  assert.equal(code, 0);
  assert.equal(stdout.trim(), '{"valid":true,"schema_version":"1.0","errors":[]}');
});

test('invalid manifest on standard input exits 1', async () => {
  const { code } = await runCli(['validate', '-'], { input: '{}' });
  assert.equal(code, 1);
});

test('unparseable standard input is an operational error (exit 2)', async () => {
  const { code, stderr } = await runCli(['validate', '-'], { input: '{ not json' });
  assert.equal(code, 2);
  assert.match(stderr, /Cannot parse input as JSON/);
});

// --- encoding ----------------------------------------------------------------

test('a UTF-8 BOM does not make a valid manifest fail', async () => {
  const file = join(workDir, 'bom.json');
  await writeFile(file, `\uFEFF${minimalText}`);
  const { code } = await runCli(['validate', file]);
  assert.equal(code, 0);
});

test('a BOM on standard input is tolerated as well', async () => {
  const { code } = await runCli(['validate', '-'], { input: `\uFEFF${minimalText}` });
  assert.equal(code, 0);
});

test('non-ASCII field values validate and round-trip through --json', async () => {
  const manifest = JSON.parse(minimalText);
  manifest.agent_name = 'Ünïcødé 漢字 Agent';
  const file = join(workDir, 'unicode.json');
  await writeFile(file, JSON.stringify(manifest));
  const { code, stdout } = await runCli(['validate', file, '--json']);
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).valid, true);
});

test('UTF-16 input fails as an operational error, not as an invalid manifest', async () => {
  const file = join(workDir, 'utf16.json');
  await writeFile(file, Buffer.from(`\uFEFF${minimalText}`, 'utf16le'));
  const { code } = await runCli(['validate', file]);
  assert.equal(code, 2);
});

// --- path semantics ----------------------------------------------------------

test('paths containing spaces and non-ASCII characters are read correctly', async () => {
  const dir = join(workDir, 'dir with spaces', 'ñü 漢');
  await mkdir(dir, { recursive: true });
  const file = join(dir, 'mañana manifest.json');
  await writeFile(file, minimalText);
  const { code } = await runCli(['validate', file]);
  assert.equal(code, 0);
});

// Creating a symlink on Windows needs a privilege the CI runner does not grant.
test('a symlink to a manifest is followed and validated read-only', {
  skip: process.platform === 'win32' ? 'symlink creation requires privileges on Windows' : false,
}, async () => {
  const target = join(workDir, 'symlink-target.json');
  const link = join(workDir, 'symlink.json');
  await writeFile(target, minimalText);
  await rm(link, { force: true });
  await symlink(target, link);
  const { code } = await runCli(['validate', link]);
  assert.equal(code, 0);
  // The target is untouched: the CLI never writes.
  assert.equal(await readFile(target, 'utf8'), minimalText);
});

test('a directory argument is an operational error, not a crash', async () => {
  const { code, stderr } = await runCli(['validate', workDir]);
  assert.equal(code, 2);
  assert.match(stderr, /Cannot read input file/);
  assert.doesNotMatch(stderr, /at .*:\d+:\d+/); // no stack trace
});

test('an empty file is an operational error', async () => {
  const file = join(workDir, 'empty.json');
  await writeFile(file, '');
  const { code } = await runCli(['validate', file]);
  assert.equal(code, 2);
});

// --- hostile documents -------------------------------------------------------

test('a __proto__ key in the input does not pollute anything and validates normally', async () => {
  const file = join(workDir, 'proto.json');
  await writeFile(file, '{"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}}}');
  const { code, stdout } = await runCli(['validate', file, '--json']);
  assert.equal(code, 1);
  const out = JSON.parse(stdout);
  assert.equal(out.valid, false);
  assert.equal({}.polluted, undefined);
});

test('deeply nested JSON fails as an ordinary invalid manifest or operational error', async () => {
  const file = join(workDir, 'deep.json');
  await writeFile(file, `${'['.repeat(20000)}${']'.repeat(20000)}`);
  const { code, stderr } = await runCli(['validate', file]);
  assert.ok(code === 1 || code === 2, `unexpected exit code ${code}`);
  assert.doesNotMatch(stderr, /at .*:\d+:\d+/);
});

test('a top-level array is reported as invalid, not as a crash', async () => {
  const file = join(workDir, 'array.json');
  await writeFile(file, '[]');
  const { code, stdout } = await runCli(['validate', file, '--json']);
  assert.equal(code, 1);
  assert.equal(JSON.parse(stdout).valid, false);
});

// --- stream behaviour --------------------------------------------------------

test('large output is not truncated when stdout is a pipe', async () => {
  const manifest = { manifest_version: '1.0', forbidden_actions: Array(5000).fill('x') };
  const file = join(workDir, 'many-errors.json');
  await writeFile(file, JSON.stringify(manifest));

  const piped = await runCli(['validate', file, '--json']);
  assert.equal(piped.code, 1);

  const parsed = JSON.parse(piped.stdout); // would throw on truncation
  assert.ok(parsed.errors.length > 100);
  assert.ok(piped.stdout.length > 100_000, `stdout was ${piped.stdout.length} bytes`);
});

test('results go to stdout and operational errors go to stderr', async () => {
  const valid = await runCli(['validate', MINIMAL]);
  assert.equal(valid.stderr, '');
  assert.notEqual(valid.stdout, '');

  const failed = await runCli(['validate', join(workDir, 'missing.json')]);
  assert.equal(failed.stdout, '');
  assert.notEqual(failed.stderr, '');
});

test('--json keeps every outcome on stdout, including operational errors', async () => {
  const { code, stdout, stderr } = await runCli([
    'validate',
    join(workDir, 'missing.json'),
    '--json',
  ]);
  assert.equal(code, 2);
  assert.equal(stderr, '');
  assert.equal(JSON.parse(stdout).valid, null);
});

// --- colour ------------------------------------------------------------------

test('output carries no ANSI escapes when stdout is not a TTY', async () => {
  const { stdout } = await runCli(['validate', MINIMAL]);
  assert.doesNotMatch(stdout, /\[/);
});

test('FORCE_COLOR emits colour and --no-color overrides it', async () => {
  const forced = await runCli(['validate', MINIMAL], { env: { FORCE_COLOR: '1' } });
  assert.match(forced.stdout, /\[32m/);

  const suppressed = await runCli(['validate', MINIMAL, '--no-color'], {
    env: { FORCE_COLOR: '1' },
  });
  assert.doesNotMatch(suppressed.stdout, /\[/);

  const noColor = await runCli(['validate', MINIMAL], { env: { FORCE_COLOR: '1', NO_COLOR: '1' } });
  assert.doesNotMatch(noColor.stdout, /\[/);
});

test('colour is suppressed on the error channel too', async () => {
  const { stderr } = await runCli(['validate', join(workDir, 'missing.json'), '--no-color'], {
    env: { FORCE_COLOR: '1' },
  });
  assert.doesNotMatch(stderr, /\[/);
  assert.match(stderr, /^Error: /);
});

// --- usage surface -----------------------------------------------------------

test('--help exits 0, writes to stdout and documents the exit codes', async () => {
  const { code, stdout, stderr } = await runCli(['--help']);
  assert.equal(code, 0);
  assert.equal(stderr, '');
  assert.match(stdout, /agent-manifest validate/);
  assert.match(stdout, /Exit codes:/);
  assert.match(stdout, /--no-color/);
});

test('an unknown option is rejected before anything is read', async () => {
  const { code, stderr } = await runCli(['validate', MINIMAL, '--enforce']);
  assert.equal(code, 2);
  assert.match(stderr, /Unknown option: --enforce/);
});

test('--schema=<path> is accepted in the inline form', async () => {
  const schemaFile = join(workDir, 'inline-schema.json');
  await writeFile(
    schemaFile,
    JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', version: 'inline' }),
  );
  const { code, stdout } = await runCli(['validate', MINIMAL, `--schema=${schemaFile}`, '--json']);
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).schema_version, 'inline');
});
