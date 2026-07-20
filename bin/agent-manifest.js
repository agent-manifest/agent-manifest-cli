#!/usr/bin/env node
import { run } from '../src/cli.js';
import { installStreamGuards } from '../src/output.js';

// `process.exit()` is deliberately not used: when stdout is a pipe, writes are
// flushed asynchronously and exiting eagerly truncates output. Setting
// `process.exitCode` lets the event loop drain first, so `agent-manifest
// validate x --json | jq` receives the whole object.
installStreamGuards();
process.exitCode = await run(process.argv.slice(2));
