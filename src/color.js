/**
 * Minimal, dependency-free ANSI colouring.
 *
 * Colour is presentation only: every message is fully readable without it, and
 * no information is encoded in colour alone. Precedence, highest first:
 *
 *   1. `--no-color` on the command line
 *   2. `NO_COLOR` in the environment (any non-empty value) — https://no-color.org
 *   3. `FORCE_COLOR` in the environment (any value other than "0")
 *   4. stdout being a TTY
 *
 * When colour is disabled every helper is the identity function, so output is
 * byte-identical to the coloured form minus the escape sequences.
 */

const CODES = {
  red: ['\u001B[31m', '\u001B[39m'],
  green: ['\u001B[32m', '\u001B[39m'],
  yellow: ['\u001B[33m', '\u001B[39m'],
};

/**
 * Decide whether colour should be emitted.
 *
 * @param {{ noColor?: boolean }} opts Parsed CLI options.
 * @param {NodeJS.ProcessEnv} env Environment to read.
 * @param {boolean} isTty Whether the destination stream is a TTY.
 * @returns {boolean}
 */
export function shouldUseColor(opts, env, isTty) {
  if (opts && opts.noColor) return false;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  return Boolean(isTty);
}

/**
 * Build a colouring helper set.
 *
 * @param {boolean} enabled
 * @returns {{ red: (s: string) => string, green: (s: string) => string, yellow: (s: string) => string }}
 */
export function createColors(enabled) {
  const wrap = (name) => {
    if (!enabled) return (s) => String(s);
    const [open, close] = CODES[name];
    return (s) => `${open}${s}${close}`;
  };
  return { red: wrap('red'), green: wrap('green'), yellow: wrap('yellow') };
}
