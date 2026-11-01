// Pure reducer that assembles one assistant reply from session events.
// Ported (only what this slice needs) from the official client's reducer.
import type { ServerEvent } from './sse';

export type ReplyBlock = { kind: 'text' | 'reasoning'; ordinal: number; text: string };
export type ReplyTool = { id: string; name: string };
export type ReplyStep = { id: string; blocks: ReplyBlock[]; tools: ReplyTool[]; error?: string };
export type ReplyStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'interrupted';
export type ReplyError = { type: string; message: string };

export type ReplyState = {
  sessionID: string;
  status: ReplyStatus;
  steps: ReplyStep[];
  error?: ReplyError;
  interruptReason?: string;
};

export const initialReply = (sessionID: string): ReplyState => ({ sessionID, status: 'idle', steps: [] });

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const int = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined);

function parseError(value: unknown): ReplyError {
  const e = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return { type: str(e.type) ?? 'unknown', message: str(e.message) ?? 'The model request failed.' };
}

function updateStep(state: ReplyState, id: string, update: (step: ReplyStep) => ReplyStep): ReplyState {
  const index = state.steps.findIndex((s) => s.id === id);
  if (index === -1) {
    return { ...state, steps: [...state.steps, update({ id, blocks: [], tools: [] })] };
  }
  return { ...state, steps: state.steps.map((s, i) => (i === index ? update(s) : s)) };
}

function updateBlock(
  step: ReplyStep,
  kind: ReplyBlock['kind'],
  ordinal: number,
  update: (text: string) => string,
): ReplyStep {
  const existing = step.blocks.find((b) => b.kind === kind && b.ordinal === ordinal);
  if (!existing) return { ...step, blocks: [...step.blocks, { kind, ordinal, text: update('') }] };
  return {
    ...step,
    blocks: step.blocks.map((b) => (b === existing ? { ...b, text: update(b.text) } : b)),
  };
}

type Data = Record<string, unknown>;
type Handler = (state: ReplyState, d: Data, messageID: string | undefined) => ReplyState;

const touchStep: Handler = (state, _d, messageID) => (messageID ? updateStep(state, messageID, (s) => s) : state);

const blockHandler =
  (kind: ReplyBlock['kind'], update: (text: string, d: Data) => string | undefined): Handler =>
  (state, d, messageID) => {
    const ordinal = int(d.ordinal);
    if (!messageID || ordinal === undefined) return state;
    return updateStep(state, messageID, (step) => updateBlock(step, kind, ordinal, (text) => update(text, d) ?? text));
  };

const appendDelta = (text: string, d: Data) => text + (str(d.delta) ?? '');
const replaceWithEnded = (_text: string, d: Data) => str(d.text);
const keep = (text: string) => text;

const toolStarted: Handler = (state, d, messageID) => {
  const id = str(d.id);
  const name = str(d.name);
  if (!messageID || !id || !name) return state;
  return updateStep(state, messageID, (s) =>
    s.tools.some((t) => t.id === id) ? s : { ...s, tools: [...s.tools, { id, name }] },
  );
};

const HANDLERS: Record<string, Handler> = {
  'session.execution.started': (state) => ({ ...state, status: 'running' }),
  'session.execution.succeeded': (state) => ({ ...state, status: 'succeeded' }),
  'session.execution.failed': (state, d) => ({ ...state, status: 'failed', error: parseError(d.error) }),
  'session.execution.interrupted': (state, d) => ({ ...state, status: 'interrupted', interruptReason: str(d.reason) }),
  'session.step.started': touchStep,
  'session.step.streamed': touchStep,
  'session.step.ended': touchStep,
  'session.step.failed': (state, d, messageID) =>
    messageID ? updateStep(state, messageID, (s) => ({ ...s, error: parseError(d.error).message })) : state,
  'session.text.started': blockHandler('text', keep),
  'session.text.delta': blockHandler('text', appendDelta),
  'session.text.ended': blockHandler('text', replaceWithEnded),
  'session.reasoning.started': blockHandler('reasoning', keep),
  'session.reasoning.delta': blockHandler('reasoning', appendDelta),
  'session.reasoning.ended': blockHandler('reasoning', replaceWithEnded),
  'session.tool.input.started': toolStarted,
};

export function reduceReply(state: ReplyState, event: ServerEvent): ReplyState {
  const d: Data = event.data ?? {};
  if (d.sessionID !== state.sessionID) return state;
  const handler = Object.hasOwn(HANDLERS, event.type) ? HANDLERS[event.type] : undefined;
  return handler ? handler(state, d, str(d.assistantMessageID)) : state;
}

const joinBlocks = (state: ReplyState, kind: ReplyBlock['kind']) =>
  state.steps
    .flatMap((s) => s.blocks)
    .filter((b) => b.kind === kind && b.text !== '')
    .map((b) => b.text)
    .join('\n\n');

export const replyText = (state: ReplyState) => joinBlocks(state, 'text');
export const replyReasoning = (state: ReplyState) => joinBlocks(state, 'reasoning');

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function addSnapshotPart(step: ReplyStep, part: unknown): void {
  if (!isRecord(part)) return;
  if ((part.type === 'text' || part.type === 'reasoning') && typeof part.text === 'string') {
    const ordinal = step.blocks.filter((b) => b.kind === part.type).length;
    step.blocks.push({ kind: part.type, ordinal, text: part.text });
  } else if (part.type === 'tool' && typeof part.id === 'string' && typeof part.name === 'string') {
    step.tools.push({ id: part.id, name: part.name });
  }
}

function snapshotStep(message: Record<string, unknown>): ReplyStep {
  const step: ReplyStep = { id: message.id as string, blocks: [], tools: [] };
  if (Array.isArray(message.content)) for (const part of message.content) addSnapshotPart(step, part);
  return step;
}

/**
 * Rebuilds a finished reply from a GET .../message snapshot (used after a dropped
 * stream). Returns null while the turn has no `idle` marker after our user message.
 * Message IDs sort chronologically, so "after" is a string comparison.
 */
export function replyFromSnapshot(sessionID: string, userMessageID: string, messages: unknown): ReplyState | null {
  if (!Array.isArray(messages)) return null;
  const items = messages
    .filter(isRecord)
    .filter((m) => typeof m.id === 'string' && typeof m.type === 'string' && m.id > userMessageID)
    .sort((a, b) => (a.id as string).localeCompare(b.id as string));
  const idle = items.find((m) => m.type === 'idle');
  if (!idle) return null;

  const steps = items.filter((m) => m.type === 'assistant').map(snapshotStep);

  const outcome = idle.outcome;
  if (outcome === 'failed') return { sessionID, status: 'failed', steps, error: parseError(idle.error) };
  return { sessionID, status: outcome === 'interrupted' ? 'interrupted' : 'succeeded', steps };
}
