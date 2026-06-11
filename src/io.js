import { readFile } from 'node:fs/promises';
import { CliError } from './errors.js';

/** True when the reference is an http(s) URL. */
export function isUrl(ref) {
  return /^https?:\/\//i.test(ref);
}

/**
 * Read raw text from a local file path or an http(s) URL.
 *
 * The network is only ever used to read an input reference that is itself a
 * URL. Any failure (missing file, unreachable host, non-OK HTTP status,
 * unreadable body) is reported as a CliError with exit code 2 — never 1.
 *
 * @param {string} ref File path or http(s) URL.
 * @param {string} label Human label used in error messages (e.g. "input").
 * @returns {Promise<string>} Raw text contents.
 */
export async function readSource(ref, label) {
  if (isUrl(ref)) {
    let res;
    try {
      res = await fetch(ref);
    } catch {
      throw new CliError(2, `Cannot reach ${label} URL: ${ref}`);
    }
    if (!res.ok) {
      throw new CliError(2, `Cannot read ${label} URL (HTTP ${res.status}): ${ref}`);
    }
    try {
      return await res.text();
    } catch {
      throw new CliError(2, `Cannot read ${label} response body: ${ref}`);
    }
  }

  try {
    return await readFile(ref, 'utf8');
  } catch {
    throw new CliError(2, `Cannot read ${label} file: ${ref}`);
  }
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
