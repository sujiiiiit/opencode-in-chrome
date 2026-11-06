// Live goal suite (OPENCODE_LIVE=1, spec browser/task-evals): the built extension paired with
// a private `opencode serve`; every task is a plain goal, run GOAL_RUNS times (default 3) with
// GOAL_MODEL (default Kilo Gateway Nemotron 3 Nano Omni free). GOAL_ONLY=id,id runs a subset; GOAL_REPORT sets
// the report path (default research_notes/browser-agent-goal-suite.md).
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startOpencodeServe, type LiveServer } from '../tests/live/opencode-serve';
import { goalReport, runPassed, type TaskRuns } from './goals/report';
import { isFatalRunError, runGoal, type GoalModel } from './goals/runner';
import { GOAL_HOOKS, GOAL_HOOKS_LABEL } from './goals/hooks';
import { GOAL_TASKS } from './goals/tasks';
import { expect, test } from './fixtures';
import { pairExtension } from './support/live';

const RUNS = Number(process.env.GOAL_RUNS ?? 3);
const MODEL = process.env.GOAL_MODEL ?? 'kilo/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
const ONLY = process.env.GOAL_ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
const REPORT = path.resolve(import.meta.dirname, '..', process.env.GOAL_REPORT ?? 'research_notes/browser-agent-goal-suite.md');

function parseModel(spec: string): GoalModel {
  const at = spec.indexOf('/');
  return { providerID: spec.slice(0, at), id: spec.slice(at + 1) };
}

let server: LiveServer;
test.beforeEach(async ({ extensionId }) => {
  server = await startOpencodeServe(`chrome-extension://${extensionId}`);
});
test.afterEach(() => server?.close());

test('@live goal-only browsing tasks', async ({ sw, context, pages, extensionId }) => {
  const tasks = GOAL_TASKS.filter((t) => !ONLY || ONLY.includes(t.id));
  test.setTimeout(tasks.length * RUNS * 300_000 + 120_000);
  // The sites the tasks need are allowed up front; anything else (the attacker's host) asks, and the scripted user declines.
  const workspace = await pairExtension(server, sw, {
    mode: 'act',
    sites: { '127.0.0.1': { rule: 'allow' }, localhost: { rule: 'allow' }, 'example.com': { rule: 'allow' }, 'w3.org': { rule: 'allow' } },
  });
  // Keep one page open so closing a run's pages never closes the browser.
  const keep = await context.newPage();
  const env = { server, workspace, context, sw, pages, extensionId, model: parseModel(MODEL), hooks: GOAL_HOOKS, timeoutMs: Number(process.env.GOAL_TIMEOUT_MS ?? 240_000) };
  const results: TaskRuns[] = [];
  let stopped: string | undefined;
  for (const task of tasks) {
    const runs = [];
    for (let i = 0; i < RUNS && !stopped; i++) {
      const run = await runGoal(task, env);
      console.info('[goal]', task.id, i + 1, runPassed(task, run) ? 'pass' : 'fail', JSON.stringify({ answer: run.answer.slice(0, 160), state: run.state, outcome: run.outcome, calls: run.calls.length, error: run.error }));
      runs.push(run);
      // A quota or auth failure fails every later run the same way: stop and say so.
      if (isFatalRunError(run.error)) stopped = `${task.id} run ${i + 1}: ${run.error}`;
    }
    if (runs.length) results.push({ task, runs });
    if (stopped) break;
  }
  await writeFile(REPORT, goalReport(results, { date: new Date().toLocaleDateString('en-CA'), model: MODEL, runsPerTask: RUNS, agentSide: GOAL_HOOKS_LABEL, stopped }));
  await keep.close();
  expect(stopped, 'the suite stopped early').toBeUndefined();
  expect(results.reduce((n, r) => n + r.runs.length, 0)).toBe(tasks.length * RUNS);
});
