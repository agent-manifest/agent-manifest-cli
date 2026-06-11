/**
 * Error carrying an explicit process exit code.
 *
 * Used for all conditions that must terminate with exit code 2:
 * I/O failures, JSON parse failures, schema load failures, unreachable
 * input URLs, and CLI usage errors.
 */
export class CliError extends Error {
  /**
   * @param {number} code Process exit code to use.
   * @param {string} message Human-readable, single-line message (no stack).
   */
  constructor(code, message) {
    super(message);
    this.name = 'CliError';
    this.code = code;
  }
}
