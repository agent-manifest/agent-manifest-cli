import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { CliError } from './errors.js';

/**
 * Convert a single Ajv error object into the public { path, message } shape.
 *
 * For "required" errors the missing property is appended to the instance path
 * so the JSON path points at the field that should exist. The message is taken
 * verbatim from Ajv — no suggestions, scoring, or rewrites are added.
 */
function formatError(err) {
  let path = err.instancePath || '';
  if (err.keyword === 'required' && err.params && err.params.missingProperty) {
    path = `${path}/${err.params.missingProperty}`;
  }
  if (path === '') {
    path = '/';
  }
  return { path, message: err.message || 'validation error' };
}

/**
 * Compile a parsed JSON Schema into a validation function.
 *
 * Compilation is part of the schema-load stage: a failure here is an
 * operational error (exit code 2), not a manifest validation failure.
 *
 * @param {object} schema Parsed JSON Schema document.
 * @returns {(data: unknown) => boolean} Ajv validate function.
 */
export function compileSchema(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  try {
    return ajv.compile(schema);
  } catch (err) {
    throw new CliError(2, `Cannot compile schema: ${err.message}`);
  }
}

/**
 * Run a compiled validate function against parsed manifest data.
 *
 * Performs structural schema validation only. It does not score, rank,
 * recommend, or enforce anything beyond what the schema declares.
 *
 * @param {(data: unknown) => boolean} validateFn Compiled Ajv validate function.
 * @param {unknown} data Parsed manifest document.
 * @returns {{ valid: boolean, errors: Array<{path: string, message: string}> }}
 */
export function validateData(validateFn, data) {
  const ok = validateFn(data);
  if (ok) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: (validateFn.errors || []).map(formatError),
  };
}
