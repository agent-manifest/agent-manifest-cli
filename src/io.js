import { readFile } from 'node:fs/promises';
import { CliError } from './errors.js';

/**
 * Hard limits applied to reads that are not ordinary local files.
 *
 * They exist so that a hostile or misconfigured endpoint cannot hang the CLI in
 * CI or exhaust memory. Local files are not fetched and are not subject to the
 * byte limit; an unreadably large local file fails as an ordinary read error.
 */
export const NETWORK_TIMEOUT_MS = 30_000;
export const MAX_INPUT_BYTES = 8 * 1024 * 1024;

/** Reference meaning "read from standard input". */
export const STDIN_REF = '-';

/** True when the reference is an http(s) URL. */
export function isUrl(ref) {
  return /^https?:\/\//i.test(ref);
}

/** Human label for a source reference, used in messages. */
export function describeRef(ref) {
  return ref === STDIN_REF ? 'standard input' : ref;
}

/**
 * Remove a leading UTF-8 byte order mark.
 *
 * Editors on Windows routinely write a BOM. `JSON.parse` rejects it, so a
 * well-formed manifest would otherwise fail as unparseable.
 */
export function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Read all of standard input as UTF-8 text. */
async function readStdin(label) {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > MAX_INPUT_BYTES) {
        throw new CliError(2, `${label} on standard input exceeds ${MAX_INPUT_BYTES} bytes.`);
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError(2, `Cannot read ${label} from standard input.`);
  }
}

/** Read an http(s) URL as text, bounded by a timeout and a byte limit. */
async function readUrl(ref, label) {
  let res;
  try {
    res = await fetch(ref, { signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS), redirect: 'follow' });
  } catch (err) {
    if (err && err.name === 'TimeoutError') {
      throw new CliError(2, `Timed out after ${NETWORK_TIMEOUT_MS} ms reading ${label} URL: ${ref}`);
    }
    throw new CliError(2, `Cannot reach ${label} URL: ${ref}`);
  }
  if (!res.ok) {
    throw new CliError(2, `Cannot read ${label} URL (HTTP ${res.status}): ${ref}`);
  }

  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_INPUT_BYTES) {
    throw new CliError(2, `${label} URL exceeds ${MAX_INPUT_BYTES} bytes: ${ref}`);
  }

  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > MAX_INPUT_BYTES) {
        throw new CliError(2, `${label} URL exceeds ${MAX_INPUT_BYTES} bytes: ${ref}`);
      }
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError(2, `Cannot read ${label} response body: ${ref}`);
  }
}

/**
 * Read raw text from standard input, a local file path, or an http(s) URL.
 *
 * The network is used only when the reference is itself an http(s) URL. Any
 * failure (missing file, unreachable host, non-OK HTTP status, oversized or
 * unreadable body) is reported as a CliError with exit code 2 — never 1.
 *
 * Nothing is ever written: the CLI reads the references it is given and emits
 * to stdout and stderr only.
 *
 * @param {string} ref `-`, a file path, or an http(s) URL.
 * @param {string} label Human label used in error messages (e.g. "input").
 * @returns {Promise<string>} Raw text contents, without a leading BOM.
 */
export async function readSource(ref, label) {
  if (ref === STDIN_REF) return stripBom(await readStdin(label));
  if (isUrl(ref)) return stripBom(await readUrl(ref, label));

  let text;
  try {
    text = await readFile(ref, 'utf8');
  } catch {
    throw new CliError(2, `Cannot read ${label} file: ${ref}`);
  }
  return stripBom(text);
}

/**
 * Parse JSON text, mapping any parse failure to an exit-code-2 CliError.
 *
 * @param {string} text Raw JSON text.
 * @param {string} label Human label used in error messages.
 * @returns {unknown} Parsed value.
 */
export function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new CliError(2, `Cannot parse ${label} as JSON: ${err.message}`);
  }
}
