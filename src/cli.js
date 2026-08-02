import { CliError } from './errors.js';
import { createColors, shouldUseColor } from './color.js';
import { readSource, parseJson, describeRef, STDIN_REF } from './io.js';
import { writeOut, writeErr } from './output.js';
import {
  loadPackagedSchema,
  loadAlternativeSchema,
  resolveAlternativeSchemaVersion,
  PACKAGED_SCHEMA_VERSION,
} from './schema.js';
import { compileSchema, validateData } from './validate.js';
import { CLI_VERSION } from './version.js';

const USAGE = `agent-manifest validate <file|url|-> [--schema <path-or-url>] [--json] [--no-color]

Validate an Agent Manifest against the packaged Agent Manifest v1.0 JSON Schema.
Structural validation only: the CLI does not score, rank, certify, or enforce.

Arguments:
  <file|url|->            Manifest to validate. "-" reads standard input.

Options:
  --schema <path-or-url>  Validate against an alternative schema instead of the
                          packaged Agent Manifest v1.0 schema.
  --json                  Emit a single machine-readable JSON object on stdout.
  --no-color              Never emit ANSI colour. NO_COLOR is also honoured.
  -h, --help              Show this help.
  -V, --version           Show the CLI version.

Exit codes:
  0  Manifest is valid.
  1  Manifest was read and parsed but failed schema validation.
  2  I/O, parse, schema-load or usage error; validation did not complete.

Examples:
  agent-manifest validate ./manifest.json
  agent-manifest validate ./manifest.json --json
  cat ./manifest.json | agent-manifest validate -
  agent-manifest validate https://example.com/agent-manifest.json`;

/** Parse argv (without node/script) into options and positionals. */
export function parseArgs(argv) {
  const opts = { json: false, schema: null, help: false, version: false, noColor: false };
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--no-color') {
      opts.noColor = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--version' || arg === '-V') {
      opts.version = true;
    } else if (arg === '--schema') {
      const value = argv[++i];
      if (value === undefined) {
        throw new CliError(2, 'Option --schema requires a value.');
      }
      opts.schema = value;
    } else if (arg.startsWith('--schema=')) {
      opts.schema = arg.slice('--schema='.length);
    } else if (arg.startsWith('-') && arg !== STDIN_REF) {
      throw new CliError(2, `Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  return { opts, positionals };
}

/** Print the human-readable result and return the exit code. */
function reportHuman(result, schemaVersion, inputRef, colors) {
  const versionLabel = schemaVersion == null ? 'unresolved' : schemaVersion;
  const source = describeRef(inputRef);

  if (result.valid) {
    writeOut(`${colors.green('Valid')} Agent Manifest (schema ${versionLabel}): ${source}\n`);
    return 0;
  }

  writeOut(`${colors.red('Invalid')} Agent Manifest (schema ${versionLabel}): ${source}\n\n`);
  for (const error of result.errors) {
    writeOut(`  ${colors.yellow(error.path)}  ${error.message}\n`);
  }
  const count = result.errors.length;
  writeOut(`\n${count} ${count === 1 ? 'error' : 'errors'}\n`);
  return 1;
}

/** Print the machine-readable JSON result (valid true/false) and return the exit code. */
function reportJson(result, schemaVersion) {
  const payload = {
    valid: result.valid,
    schema_version: schemaVersion,
    errors: result.errors,
  };
  writeOut(`${JSON.stringify(payload)}\n`);
  return result.valid ? 0 : 1;
}

/**
 * Emit an operational (exit-code-2) error.
 *
 * With --json, the third output shape is written to stdout so a machine
 * consumer reads a single parseable object on the same channel as success.
 * Without --json, a single-line message is written to stderr. No stack traces.
 *
 * @param {CliError|Error} err
 * @param {{ json: boolean, schemaVersion: string|number|null, colors: object }} ctx
 */
function reportOperationalError(err, ctx) {
  if (ctx.json) {
    const payload = {
      valid: null,
      schema_version: ctx.schemaVersion,
      errors: [{ path: '', message: err.message }],
    };
    writeOut(`${JSON.stringify(payload)}\n`);
  } else {
    writeErr(`${ctx.colors.red('Error:')} ${err.message}\n`);
  }
}

/** Execute the `validate` command. */
async function runValidate(positionals, opts, ctx) {
  const inputRef = positionals[0];
  if (inputRef === undefined) {
    throw new CliError(2, 'Missing <file|url|-> argument for validate.');
  }
  if (positionals.length > 1) {
    throw new CliError(2, `Unexpected extra argument: ${positionals[1]}`);
  }

  // Schema-load stage. Until the schema is loaded and compiled, an operational
  // error reports schema_version: null.
  let schema;
  let schemaVersion;
  if (opts.schema) {
    schema = await loadAlternativeSchema(opts.schema);
    schemaVersion = resolveAlternativeSchemaVersion(schema);
  } else {
    schema = await loadPackagedSchema();
    schemaVersion = PACKAGED_SCHEMA_VERSION;
  }
  compileSchema(schema);

  // Schema is now fully loaded. Operational errors from here on report the
  // resolved schema_version.
  ctx.schemaVersion = schemaVersion;

  // Input stage.
  const inputText = await readSource(inputRef, 'input');
  const data = parseJson(inputText, 'input');

  const result = validateData(schema, data);

  return opts.json
    ? reportJson(result, schemaVersion)
    : reportHuman(result, schemaVersion, inputRef, ctx.colors);
}

/**
 * Top-level entry point. Returns a process exit code; never throws.
 *
 * @param {string[]} argv Arguments after the node executable and script.
 * @returns {Promise<number>}
 */
export async function run(argv) {
  // schemaVersion starts null and is promoted once the schema is loaded, so the
  // exit-2 JSON shape reports the correct stage. --json and --no-color are
  // pre-detected so that an error during argument parsing still honours them.
  const preOpts = { noColor: argv.includes('--no-color') };
  const ctx = {
    json: argv.includes('--json'),
    schemaVersion: null,
    colors: createColors(shouldUseColor(preOpts, process.env, process.stdout.isTTY)),
  };

  try {
    const { opts, positionals } = parseArgs(argv);
    ctx.json = opts.json;
    ctx.colors = createColors(shouldUseColor(opts, process.env, process.stdout.isTTY));

    if (opts.version) {
      writeOut(`${CLI_VERSION}\n`);
      return 0;
    }
    if (opts.help) {
      writeOut(`${USAGE}\n`);
      return 0;
    }
    if (positionals.length === 0) {
      throw new CliError(2, 'No command provided. Run "agent-manifest --help" for usage.');
    }

    const command = positionals[0];
    if (command !== 'validate') {
      throw new CliError(2, `Unknown command: ${command}. The only command is "validate".`);
    }

    return await runValidate(positionals.slice(1), opts, ctx);
  } catch (err) {
    const code = err instanceof CliError ? err.code : 2;
    reportOperationalError(err, ctx);
    return code;
  }
}
