import pc from 'picocolors';
import { CliError } from './errors.js';
import { readSource, parseJson } from './io.js';
import {
  loadVendoredSchema,
  loadAlternativeSchema,
  resolveAlternativeSchemaVersion,
  VENDORED_SCHEMA_VERSION,
} from './schema.js';
import { compileSchema, validateData } from './validate.js';

const USAGE = `agent-manifest validate <file|url> [--schema <path-or-url>] [--json]

Validate an Agent Manifest against the vendored Agent Manifest v1.0 schema.

Options:
  --schema <path-or-url>  Validate against an alternative schema.
  --json                  Emit machine-readable JSON output.
  -h, --help              Show this help.
  -V, --version           Show the CLI version.`;

/** Parse argv (without node/script) into options and positionals. */
export function parseArgs(argv) {
  const opts = { json: false, schema: null, help: false, version: false };
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
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
    } else if (arg.startsWith('-') && arg !== '-') {
      throw new CliError(2, `Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  return { opts, positionals };
}

/** Print human-readable result and return the exit code. */
function reportHuman(result, schemaVersion) {
  const versionLabel = schemaVersion == null ? 'unresolved' : schemaVersion;
  if (result.valid) {
    process.stdout.write(
      `${pc.green('✔')} Valid Agent Manifest (schema ${versionLabel})\n`,
    );
    return 0;
  }

  process.stdout.write(
    `${pc.red('✖')} Invalid Agent Manifest (schema ${versionLabel})\n\n`,
  );
  for (const error of result.errors) {
    process.stdout.write(`  ${pc.yellow(error.path)}  ${error.message}\n`);
  }
  const count = result.errors.length;
  process.stdout.write(`\n${count} ${count === 1 ? 'error' : 'errors'}\n`);
  return 1;
}

/** Print machine-readable JSON result (valid true/false) and return the exit code. */
function reportJson(result, schemaVersion) {
  const payload = {
    valid: result.valid,
    schema_version: schemaVersion,
    errors: result.errors,
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
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
 * @param {{ json: boolean, schemaVersion: string|number|null }} ctx
 */
function reportOperationalError(err, ctx) {
  if (ctx.json) {
    const payload = {
      valid: null,
      schema_version: ctx.schemaVersion,
      errors: [{ path: '', message: err.message }],
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stderr.write(`${pc.red('Error:')} ${err.message}\n`);
  }
}

/** Execute the `validate` command. */
async function runValidate(positionals, opts, ctx) {
  const inputRef = positionals[0];
  if (inputRef === undefined) {
    throw new CliError(2, 'Missing <file|url> argument for validate.');
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
    schema = await loadVendoredSchema();
    schemaVersion = VENDORED_SCHEMA_VERSION;
  }
  const validateFn = compileSchema(schema);

  // Schema is now fully loaded. Operational errors from here on report the
  // resolved schema_version.
  ctx.schemaVersion = schemaVersion;

  // Input stage.
  const inputText = await readSource(inputRef, 'input');
  const data = parseJson(inputText, 'input');

  const result = validateData(validateFn, data);

  return opts.json
    ? reportJson(result, schemaVersion)
    : reportHuman(result, schemaVersion);
}

/**
 * Top-level entry point. Returns a process exit code; never throws.
 *
 * @param {string[]} argv Arguments after the node executable and script.
 * @returns {Promise<number>}
 */
export async function run(argv) {
  // schemaVersion starts null and is promoted once the schema is loaded, so the
  // exit-2 JSON shape reports the correct stage. json is pre-detected so that an
  // error during argument parsing can still honor --json.
  const ctx = { json: argv.includes('--json'), schemaVersion: null };

  try {
    const { opts, positionals } = parseArgs(argv);
    ctx.json = opts.json;

    if (opts.version) {
      process.stdout.write('0.1.0\n');
      return 0;
    }
    if (opts.help) {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }
    if (positionals.length === 0) {
      throw new CliError(2, 'No command provided. Run "agent-manifest --help" for usage.');
    }

    const command = positionals[0];
    if (command !== 'validate') {
      throw new CliError(2, `Unknown command: ${command}`);
    }

    return await runValidate(positionals.slice(1), opts, ctx);
  } catch (err) {
    const code = err instanceof CliError ? err.code : 2;
    reportOperationalError(err, ctx);
    return code;
  }
}
