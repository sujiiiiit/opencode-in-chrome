// Runs the live tests (a real `opencode serve` and the kilo/kilo-auto/free model):
// the Vitest live integration tests, then the @live Playwright specs.
import { spawnSync } from 'node:child_process';

const env = { ...process.env, OPENCODE_LIVE: '1' };
const run = (args) => spawnSync('pnpm', ['exec', ...args], { stdio: 'inherit', env, shell: true }).status ?? 1;

let status = run(['vitest', 'run', 'tests/live']);
if (status === 0) status = run(['wxt', 'build']);
if (status === 0) status = run(['playwright', 'test', '--grep', '@live']);
process.exit(status);
