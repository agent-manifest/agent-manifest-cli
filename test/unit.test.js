import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../src/cli.js';
import { shouldUseColor, createColors } from '../src/color.js';
import { stripBom, isUrl, describeRef, readSource } from '../src/io.js';
import { loadPackagedSchema, resolveAlternativeSchemaVersion } from '../src/schema.js';
import { compileSchema } from '../src/validate.js';
import { CliError } from '../src/errors.js';

// --- argument parsing --------------------------------------------------------

test('parseArgs recognises every documented option', () => {
  const { opts, positionals } = parseArgs([
    'validate',
    'manifest.json',
    '--json',
    '--no-color',
    '--schema',
    'alt.json',
  ]);
  assert.deepEqual(positionals, ['validate', 'manifest.json']);
  assert.equal(opts.json, true);
  assert.equal(opts.noColor, true);
  assert.equal(opts.schema, 'alt.json');
});

test('parseArgs accepts --schema=<value> and treats "-" as a positional', () => {
  const { opts, positionals } = parseArgs(['validate', '-', '--schema=alt.json']);
  assert.deepEqual(positionals, ['validate', '-']);
  assert.equal(opts.schema, 'alt.json');
});

test('parseArgs rejects an unknown option and a valueless --schema', () => {
  assert.throws(() => parseArgs(['validate', 'x', '--enforce']), CliError);
  assert.throws(() => parseArgs(['validate', 'x', '--schema']), CliError);
});

// --- colour precedence -------------------------------------------------------

test('colour precedence is --no-color, NO_COLOR, FORCE_COLOR, then TTY', () => {
  assert.equal(shouldUseColor({ noColor: true }, { FORCE_COLOR: '1' }, true), false);
  assert.equal(shouldUseColor({}, { NO_COLOR: '1', FORCE_COLOR: '1' }, true), false);
  assert.equal(shouldUseColor({}, { NO_COLOR: '' }, true), true);
  assert.equal(shouldUseColor({}, { FORCE_COLOR: '1' }, false), true);
  assert.equal(shouldUseColor({}, { FORCE_COLOR: '0' }, false), false);
  assert.equal(shouldUseColor({}, {}, true), true);
  assert.equal(shouldUseColor({}, {}, false), false);
});

test('disabled colours are the identity function', () => {
  const off = createColors(false);
  assert.equal(off.red('x'), 'x');
  const on = createColors(true);
  assert.equal(on.red('x'), '\u001B[31mx\u001B[39m');
});

// --- reference handling ------------------------------------------------------

test('stripBom removes only a leading BOM', () => {
  assert.equal(stripBom('\uFEFF{}'), '{}');
  assert.equal(stripBom('{}'), '{}');
  assert.equal(stripBom('{"a":"\uFEFF"}'), '{"a":"\uFEFF"}');
});

test('isUrl accepts http(s) only', () => {
  assert.equal(isUrl('https://example.com/m.json'), true);
  assert.equal(isUrl('HTTP://example.com/m.json'), true);
  assert.equal(isUrl('file:///etc/passwd'), false);
  assert.equal(isUrl('./manifest.json'), false);
  assert.equal(isUrl('-'), false);
});

test('describeRef names standard input', () => {
  assert.equal(describeRef('-'), 'standard input');
  assert.equal(describeRef('./m.json'), './m.json');
});

// --- schema version resolution ----------------------------------------------

test('resolveAlternativeSchemaVersion prefers version, then $id, then null', () => {
  assert.equal(resolveAlternativeSchemaVersion({ version: '2', $id: 'x' }), '2');
  assert.equal(resolveAlternativeSchemaVersion({ $id: 'x' }), 'x');
  assert.equal(resolveAlternativeSchemaVersion({}), null);
  assert.equal(resolveAlternativeSchemaVersion(null), null);
  assert.equal(resolveAlternativeSchemaVersion('not an object'), null);
});

test('an uncompilable schema is an operational error, not a validation failure', () => {
  assert.throws(() => compileSchema({ type: 'not-a-type' }), (err) => {
    assert.ok(err instanceof CliError);
    assert.equal(err.code, 2);
    return true;
  });
});

// --- the default path never touches the network ------------------------------

test('the packaged schema and a local file are read without any fetch', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('the default path must not use the network');
  };
  try {
    const schema = await loadPackagedSchema();
    assert.equal(schema.$id, 'https://agent-manifest-spec.org/spec/v1.0/schema.json');

    const text = await readSource(
      fileURLToPath(new URL('../examples/minimal.json', import.meta.url)),
      'input',
    );
    assert.ok(text.includes('manifest_version'));
  } finally {
    globalThis.fetch = realFetch;
  }
});
