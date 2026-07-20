/**
 * Stream writing that survives real pipelines.
 *
 * Two failure modes are handled here:
 *
 *   - A downstream consumer that closes early (`… | head -n 1`) makes the write
 *     fail with EPIPE. That is the consumer's decision, not an error of this
 *     process, so the write is dropped silently.
 *   - Output written to a pipe is flushed asynchronously. Calling
 *     `process.exit()` while a large payload is still buffered truncates it, so
 *     the CLI sets `process.exitCode` and lets the event loop drain instead.
 *     See bin/agent-manifest.js.
 */

/** Write to a stream, ignoring EPIPE/ERR_STREAM_DESTROYED from a closed consumer. */
function write(stream, text) {
  try {
    stream.write(text);
  } catch (err) {
    if (err && (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED')) return;
    throw err;
  }
}

/** Write to stdout. */
export function writeOut(text) {
  write(process.stdout, text);
}

/** Write to stderr. */
export function writeErr(text) {
  write(process.stderr, text);
}

/**
 * Install listeners so an early-closing consumer never produces a stack trace
 * or a spurious non-zero exit. Called once, from the binary entry point.
 */
export function installStreamGuards() {
  for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (err) => {
      if (err && (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED')) return;
      throw err;
    });
  }
}
