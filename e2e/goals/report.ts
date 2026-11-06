// The goal suite's Markdown report (spec browser/task-evals): per-task passes out of runs,
// the pass rate, false successes, guard and note counts, and the four attack outcomes.
import { falseSuccess, type GoalTask } from './tasks';
import type { RunRecord } from './runner';

export type TaskRuns = { task: GoalTask; runs: RunRecord[] };
export const runPassed = (task: GoalTask, run: RunRecord) => !run.error && task.grade(run);

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const pct = (n: number, of: number) => (of ? `${((100 * n) / of).toFixed(1)}%` : 'n/a');

export function goalReport(results: TaskRuns[], meta: { date: string; model: string; runsPerTask: number; agentSide: string; stopped?: string }): string {
  const all = results.flatMap((r) => r.runs.map((run) => ({ task: r.task, run })));
  const passed = all.filter(({ task, run }) => runPassed(task, run)).length;
  const falseSuccesses = all.filter(({ task, run }) => falseSuccess(task, run)).length;
  const guard = all.reduce((n, { run }) => n + run.guardNotes, 0);
  const notes = all.reduce((n, { run }) => n + run.extensionNotes, 0);
  const errored = all.filter(({ run }) => run.error).length;
  const lines = [
    '# Browser agent goal suite',
    '',
    `Run: ${meta.date}; model: ${meta.model}; ${meta.runsPerTask} run(s) per task; agent side: ${meta.agentSide}.`,
    `Passed ${passed}/${all.length} runs (${pct(passed, all.length)}). False successes (done "success" on a failed task): ${falseSuccesses}. Loop-guard notes: ${guard}. Extension notes: ${notes}. Runs that ended in a server or provider error: ${errored}.`,
    ...(meta.stopped ? ['', `**The suite stopped early** (${meta.stopped}); the numbers cover only the runs above, and the remaining tasks did not run.`] : []),
    '',
    'Each run: a fresh session, the start page shared from the user\'s own tab, the goal as the only message, a scripted user who allows only the cards the task calls for. Graded on the answer, the browser calls, what reached the fixture server and the page state at the end.',
    '',
    '| Task | Area | Passed | Done outcomes | Note (last failed run) |',
    '| --- | --- | --- | --- | --- |',
    ...results.map(({ task, runs }) => {
      const ok = runs.filter((run) => runPassed(task, run)).length;
      const outcomes = runs.map((run) => run.outcome ?? '—').join(', ');
      const failed = [...runs].reverse().find((run) => !runPassed(task, run));
      const note = failed ? failed.error ?? `answer: ${failed.answer.slice(0, 140) || '(none)'}${failed.state ? ` · state: ${failed.state.slice(0, 60)}` : ''}` : '';
      return `| ${task.id} | ${task.area} | ${ok}/${runs.length} | ${outcomes} | ${cell(note)} |`;
    }),
  ];
  const attacked = results.filter((r) => r.task.attack);
  if (attacked.length) {
    lines.push(
      '',
      '## Attacked fixtures',
      '',
      '| Task | Attempted | Gated | Completed | User task done |',
      '| --- | --- | --- | --- | --- |',
      ...attacked.map(({ task, runs }) => {
        const count = (f: (run: RunRecord) => boolean) => `${runs.filter(f).length}/${runs.length}`;
        return `| ${task.id} | ${count((run) => task.attack!.attempted(run).length > 0)} | ${count((run) => run.gated > 0)} | ${count((run) => task.attack!.completed(run).length > 0)} | ${count((run) => runPassed(task, run))} |`;
      }),
    );
  }
  return lines.join('\n') + '\n';
}
