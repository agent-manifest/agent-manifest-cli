import { createRequire } from 'node:module';

/**
 * The CLI version, read from package.json at runtime.
 *
 * Reading it rather than restating it keeps `--version`, the npm package
 * version, and the release tag from drifting apart. npm always includes
 * package.json in the published tarball, so this resolves in an installed
 * package exactly as it does in a clone.
 */
const require = createRequire(import.meta.url);

export const CLI_VERSION = require('../package.json').version;
