// What a finished turn's footer reports: the model, how long the turn took and how fast the model
// wrote. Ported from opencode's web timeline (session-timeline-row.tsx `duration`) and its
// SessionTurn.tokensPerSecond (packages/util/src/session-turn.ts).
import type { ReplyStep, StepModel } from './reply';
import type { Turn } from './timeline';

export type TurnStats = {
  agent?: string;
  model?: StepModel;
  /** From sending the prompt until the turn's last step ended; undefined when unknown. */
  durationMs?: number;
  /** Output and reasoning tokens per second of provider streaming; undefined until every step streamed. */
  tokensPerSecond?: number;
};

const hasText = (step: ReplyStep) => step.parts.some((part) => part.kind === 'text' && part.text.trim() !== '');

/** The step whose answer text carries the footer: the last one with text, else the last step. */
function footerStepIndex(steps: ReplyStep[]): number {
  const index = steps.findLastIndex(hasText);
  return index === -1 ? steps.length - 1 : index;
}

function durationMs(turn: Turn, steps: ReplyStep[], footer: ReplyStep | undefined): number | undefined {
  const completed = steps.reduce<number | undefined>(
    (latest, step) => (step.completed === undefined ? latest : Math.max(latest ?? step.completed, step.completed)),
    undefined,
  );
  const start = turn.created ?? footer?.created;
  if (completed === undefined || start === undefined || completed < start) return undefined;
  return completed - start;
}

type Streamed = ReplyStep & { created: number; streamed: number };

const hasStreamed = (step: ReplyStep): step is Streamed => step.created !== undefined && step.streamed !== undefined;
const generated = (step: ReplyStep) => (step.tokens?.output ?? 0) + (step.tokens?.reasoning ?? 0);
const streamingMs = (step: Streamed) => Math.max(0, step.streamed - step.created);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Aggregates before dividing, so each step weighs by how long the provider was streaming it. */
function tokensPerSecond(steps: ReplyStep[]): number | undefined {
  if (steps.length === 0 || !steps.every(hasStreamed)) return undefined;
  const tokens = sum(steps.map(generated));
  const ms = sum(steps.map(streamingMs));
  return tokens > 0 && ms > 0 ? tokens / (ms / 1000) : undefined;
}

export function turnStats(turn: Turn): TurnStats {
  const steps = turn.reply.steps;
  const index = footerStepIndex(steps);
  const footer = steps[index];
  const durationValue = durationMs(turn, steps, footer);
  const speed = tokensPerSecond(steps.slice(0, index + 1));
  return {
    ...(footer?.agent ? { agent: footer.agent } : {}),
    ...(footer?.model ? { model: footer.model } : {}),
    ...(durationValue !== undefined ? { durationMs: durationValue } : {}),
    ...(speed !== undefined ? { tokensPerSecond: speed } : {}),
  };
}

/** "42.3 tok/s", as the TUI footer shows it. */
export const formatSpeed = (perSecond: number) => `${perSecond.toFixed(1)} tok/s`;

/** A variant label follows the model name: "high" reads "High"; the default variant says nothing. */
export function variantLabel(variant: string | undefined): string | undefined {
  if (!variant || variant === 'default') return undefined;
  return variant[0]!.toUpperCase() + variant.slice(1);
}
