import { compileSchema as compileShared, validate as validateShared } from '@agent-manifest/client/validate';
import { CliError } from './errors.js';

/**
 * Structural validation, delegated to @agent-manifest/client.
 *
 * This CLI used to compile and run Ajv itself against a schema file kept in
 * this repository. Both are gone: the schema arrives as data from
 * @agent-manifest/schema and the checking is done by the shared validator, so
 * a manifest gets the same verdict here as it does anywhere else in the
 * ecosystem. What stays here is the part that is genuinely this tool's: the
 * exit-code contract.
 *
 * The shared validator reports `schemaValid`. This CLI has always reported
 * `valid` in its --json output, and that field is public contract, so it is
 * mapped at this boundary and nowhere else. The rename is deliberate upstream
 * — `valid` reads as "the agent is fine" — and the CLI's own documentation
 * carries the same caveat in prose.
 */

/**
 * Check that a schema compiles, so that an unusable schema fails as an
 * operational error rather than as a manifest that happens not to validate.
 *
 * Compilation is part of the schema-load stage: a failure here is exit code 2,
 * never a validation failure. The shared validator caches compiled functions
 * per schema object, so the compile done here is reused by validateData.
 *
 * @param {object} schema Parsed JSON Schema document.
 * @returns {object} The same schema, once it is known to compile.
 */
export function compileSchema(schema) {
  try {
    compileShared(schema);
  } catch (err) {
    throw new CliError(2, `Cannot compile schema: ${err.message}`);
  }
  return schema;
}

/**
 * Run a schema against parsed manifest data.
 *
 * Performs structural schema validation only. It does not score, rank,
 * recommend, or enforce anything beyond what the schema declares. Ajv messages
 * are passed through verbatim by the shared validator.
 *
 * @param {object} schema Parsed JSON Schema document.
 * @param {unknown} data Parsed manifest document.
 * @returns {{ valid: boolean, errors: Array<{path: string, message: string}> }}
 */
export function validateData(schema, data) {
  const result = validateShared(data, { schema });
  return { valid: result.schemaValid, errors: result.errors };
}
