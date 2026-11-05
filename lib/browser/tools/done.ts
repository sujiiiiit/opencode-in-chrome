// `done` (spec browser/task-completion, design D3): the agent reports how a browser task ended.
// "success" is refused while the session has actions whose result it has not seen.
import type { Completion } from '../completion';
import type { LoopGuard } from '../policy';
import { ToolError, type ToolDef } from './registry';

const OUTCOMES = ['success', 'partial', 'failed'] as const;
type Outcome = (typeof OUTCOMES)[number];

export function doneTool(deps: { completion: Completion; loop: LoopGuard }): ToolDef {
  return {
    name: 'done',
    description:
      'Finish a browser task and report how it ended. outcome "success" only when you have seen the result of every page action you took ' +
      '(the <browser-state> block lists the ones you have not); otherwise "partial" or "failed". summary is the answer for the user; ' +
      'after done, reply with it. Not needed for a question that took no page action.',
    inputSchema: {
      type: 'object',
      properties: {
        outcome: { type: 'string', enum: [...OUTCOMES] },
        summary: { type: 'string', description: 'The answer for the user, in Markdown: what was done, and what was not.' },
      },
      required: ['outcome', 'summary'],
    },
    async handler(args, { sessionID }) {
      const outcome = args.outcome as Outcome;
      const summary = String(args.summary).trim();
      if (!summary) throw new ToolError('INVALID_INPUT', '`summary` is required: say what was done for the user.');
      const result = deps.completion.finish(sessionID, outcome);
      if (!result.accepted) {
        throw new ToolError(
          'UNVERIFIED',
          `You have not seen the result of ${result.open.length === 1 ? 'this action' : 'these actions'}: ${result.open.join('; ')}. ` +
            'Read the tab (read_page, find or get_page_text) to check, then call done again, or call done with "partial".',
        );
      }
      deps.loop.resetSession(sessionID);
      const lines = [`Done (${result.outcome}). Now give the user this summary as your final reply:`, summary];
      if (result.outcome !== outcome) lines.push(`(Recorded as "${result.outcome}": these actions were never verified.)`);
      if (result.unverified.length) lines.push(`Also tell the user these were not verified: ${result.unverified.join('; ')}.`);
      return { text: lines };
    },
  };
}
