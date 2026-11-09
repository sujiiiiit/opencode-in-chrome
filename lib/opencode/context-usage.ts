// How full the chat's context window is, as opencode's clients report it (client/solid/usage.ts
// `lastAssistantWithUsage`, gui-plugins context/indicator.tsx): the latest step with token usage
// fills the window with its input, output, reasoning and cache tokens. A completed compaction
// starts the count over.
import type { ReplyStep, StepModel, StepTokens } from './reply';
import type { Turn } from './timeline';

export type ContextUsage = {
  /** The latest step's token counts. */
  tokens: StepTokens;
  /** Every token in the window now. */
  total: number;
  /** The model's context window; 0 when the catalog does not know it. */
  limit: number;
  /** `total` as a whole percent of `limit`; null when the limit is unknown. */
  percent: number | null;
};

const sizeOf = (t: StepTokens) => t.input + t.output + t.reasoning + t.cacheRead + t.cacheWrite;

/**
 * The latest step with token usage since the last completed compaction, which replaced everything
 * before it with its summary: until a step after it reports, nothing fills the window that is known.
 */
function latestStep(turns: readonly Turn[]): ReplyStep | undefined {
  // Newest first, so a streaming chat looks at its last step or two, not its whole history.
  for (let t = turns.length - 1; t >= 0; t--) {
    const { steps, compactions = [] } = turns[t]!.reply;
    const compactedAfter = (index: number) => compactions.some((item) => item.status === 'completed' && item.afterStep > index);
    for (let i = steps.length - 1; i >= 0; i--) {
      if (compactedAfter(i)) return undefined;
      if (steps[i]!.tokens) return steps[i];
    }
    if (compactedAfter(-1)) return undefined;
  }
  return undefined;
}

/**
 * The context usage of `turns`, or null before any step reported tokens. `limitOf` gives a
 * model's window (0 when unknown), given the step's model or undefined when it names none.
 */
export function contextUsage(
  turns: readonly Turn[],
  limitOf: (model: StepModel | undefined) => number,
): ContextUsage | null {
  const last = latestStep(turns);
  if (!last?.tokens) return null;
  const tokens = last.tokens;
  const total = sizeOf(tokens);
  const limit = limitOf(last.model);
  return {
    tokens,
    total,
    limit,
    percent: limit > 0 ? Math.round((total / limit) * 100) : null,
  };
}
