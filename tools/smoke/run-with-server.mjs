#!/usr/bin/env node
/**
 * Boot the SSR server, wait for it to accept traffic on :4000, run the
 * theme-cookie smoke suite, then stop the server — success or failure.
 *
 * Zero-dependency local mirror of the CI "SSR smoke" step (.github/workflows/ci.yml).
 * Invoked via `npm run verify` so devs get the same guarantees before pushing.
 *
 * Rationale for hand-rolling this instead of pulling `start-server-and-test`:
 * the logic is ~40 LOC of well-understood child_process + net; a dep would
 * add transitive supply-chain surface for one dev-only script.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createConnection } from 'node:net';

const PORT = 4000;
const HOST = '127.0.0.1';
const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

/** Resolve when a TCP connection to HOST:PORT succeeds, reject on error. */
function probe() {
  return new Promise((resolve, reject) => {
    const sock = createConnection({ host: HOST, port: PORT });
    sock.once('connect', () => { sock.end(); resolve(); });
    sock.once('error', reject);
  });
}

async function waitForServer() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try { await probe(); return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`SSR server did not open :${PORT} within ${READY_TIMEOUT_MS}ms`);
}

/** Spawn with `shell: false` so signals reach the Node child directly. */
const server = spawn('node', ['dist/prime-showcase/server/server.mjs'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'inherit', 'inherit'],
});

// If the server dies before smoke finishes, surface that instead of timing out.
let serverExitedEarly = false;
server.once('exit', (code) => { serverExitedEarly = true;
  if (code !== 0 && code !== null) console.error(`[run-with-server] server exited with code ${code}`);
});

let exitCode = 0;
try {
  await waitForServer();
  if (serverExitedEarly) throw new Error('SSR server exited before smoke ran');

  const smoke = spawn('node', ['tools/smoke/ssr-theme.smoke.mjs'], { stdio: 'inherit' });
  const [code] = await once(smoke, 'exit');
  exitCode = code ?? 1;
} catch (err) {
  console.error('[run-with-server]', err.message);
  exitCode = 1;
} finally {
  if (!serverExitedEarly) {
    server.kill('SIGTERM');
    // Give the process a beat to exit cleanly; escalate if it clings on.
    const timer = setTimeout(() => server.kill('SIGKILL'), 3000);
    try { await once(server, 'exit'); } catch { /* already gone */ }
    clearTimeout(timer);
  }
  process.exit(exitCode);
}
