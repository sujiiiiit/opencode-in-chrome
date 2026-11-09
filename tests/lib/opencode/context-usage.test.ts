import { describe, expect, it } from 'vitest';
import { contextUsage } from '@/lib/opencode/context-usage';
import { initialReply, type ReplyStep, type StepTokens } from '@/lib/opencode/reply';
import type { Turn } from '@/lib/opencode/timeline';
import { SESSION_ID } from '@/tests/support/testkit';

const tokens = (input: number, output: number, extra: Partial<StepTokens> = {}): StepTokens => ({
  input, output, reasoning: 0, cacheRead: 0, cacheWrite: 0, ...extra,
});
const step = (id: string, t?: StepTokens, model?: ReplyStep['model']): ReplyStep => ({ id, parts: [], ...(t ? { tokens: t } : {}), ...(model ? { model } : {}) });
const turn = (id: string, steps: ReplyStep[]): Turn => ({
  id, text: 'hi', reply: { ...initialReply(SESSION_ID), status: 'succeeded', steps },
});

describe('contextUsage', () => {
  it('is null before any step reports tokens', () => {
    expect(contextUsage([turn('u1', [step('a1')])], () => 1000)).toBeNull();
  });

  it('fills the window with the latest step, as opencode counts it', () => {
    const latest = tokens(10_050, 677, { reasoning: 175, cacheRead: 28_608 });
    const usage = contextUsage([turn('u1', [step('a1', tokens(5, 5)), step('a2', latest), step('a3')])], () => 256_000);
    expect(usage).toMatchObject({ tokens: latest, total: 39_510, limit: 256_000, percent: 15 });
  });

  it('leaves the percent unknown without a limit', () => {
    const usage = contextUsage([turn('u1', [step('a1', tokens(100, 10, { cacheRead: 50 }))])], () => 0);
    expect(usage).toMatchObject({ total: 160, limit: 0, percent: null });
  });

  it('asks for the window of the latest step model', () => {
    const model = { providerID: 'p', modelID: 'm' };
    const seen: unknown[] = [];
    contextUsage([turn('u1', [step('a1', tokens(1, 1)), step('a2', tokens(2, 1), model)])], (m) => { seen.push(m); return 100; });
    expect(seen).toEqual([model]);
  });
});

describe('contextUsage after a compaction', () => {
  const compaction = (afterStep: number, status: 'completed' | 'failed' | 'running' = 'completed') =>
    ({ id: `c${afterStep}`, afterStep, status, summary: '' });
  const compacted = (steps: ReplyStep[], compactions: ReturnType<typeof compaction>[]): Turn => {
    const base = turn('u1', steps);
    return { ...base, reply: { ...base.reply, compactions } };
  };

  it('knows nothing until a step after a completed compaction reports', () => {
    expect(contextUsage([compacted([step('a1', tokens(100, 1))], [compaction(1)])], () => 1000)).toBeNull();
  });

  it('counts the first step after it', () => {
    const usage = contextUsage([compacted([step('a1', tokens(900, 1)), step('a2', tokens(50, 1))], [compaction(1)])], () => 1000);
    expect(usage?.total).toBe(51);
  });

  it('ignores a compaction that did not finish', () => {
    const usage = contextUsage([compacted([step('a1', tokens(100, 1))], [compaction(1, 'failed'), compaction(1, 'running')])], () => 1000);
    expect(usage?.total).toBe(101);
  });
});
