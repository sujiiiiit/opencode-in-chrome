// Pure reducer that assembles one assistant reply from session events, in the order its parts
// arrived: reasoning, text and tool calls interleave as the model produced them. Ported (what
// the panel shows) from the official client's reducer.
import type { ServerEvent } from './sse';

export type ReplyStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'interrupted';
export type ReplyError = { type: string; message: string };

/** OpenAI Responses models label each text with a phase; it wins over position (see flow.ts). */
export type TextPhase = 'commentary' | 'final_answer';

export type ReplyTextPart = {
  kind: 'text' | 'reasoning';
  /** Unique within the reply: `<step>:<kind>:<ordinal>`. */
  id: string;
  ordinal: number;
  text: string;
  /** The server sent the final text (`*.ended`), or the part came from a snapshot. */
  done: boolean;
  phase?: TextPhase;
  /** Server time (ms) the part started and ended, when known. */
  started?: number;
  ended?: number;
};

/**
 * A tool call. `streaming`: the model is still writing its input; `running`: the server is
 * executing it; then `completed` or `error`.
 */
export type ToolStatus = 'streaming' | 'running' | 'completed' | 'error';

export type ToolContent = { type: 'text'; text: string } | { type: 'file'; uri: string; mime: string; name?: string };

export type ReplyToolPart = {
  kind: 'tool';
  id: string;
  name: string;
  status: ToolStatus;
  /** The input as the model streams it (JSON text, possibly incomplete). */
  inputText: string;
  /** The parsed input, once the call is complete. */
  input: Record<string, unknown>;
  /** Tool-specific progress and result data (a shell's ID and exit code, a diff, ...). */
  metadata: Record<string, unknown>;
  content: ToolContent[];
  error?: string;
  /** The call failed because the turn was interrupted (opencode fails unsettled calls as `aborted`). */
  aborted?: true;
  started?: number;
  ended?: number;
};

export type ReplyPart = ReplyTextPart | ReplyToolPart;

/** The model a step ran on, as opencode's `{id, providerID, variant?}` reference. */
export type StepModel = { providerID: string; modelID: string; variant?: string };
/** Tokens the step generated (the input side is not needed for speed). */
export type StepTokens = { output: number; reasoning: number };

export type ReplyStep = {
  id: string;
  parts: ReplyPart[];
  error?: string;
  agent?: string;
  model?: StepModel;
  /** Server times (ms): the request went out, the provider finished streaming, the step ended. */
  created?: number;
  streamed?: number;
  completed?: number;
  tokens?: StepTokens;
};

/** A background subagent's completion, placed before the step the reply picked up with. */
export type ReplyNotice = { id: string; afterStep: number };

export type ReplyState = {
  sessionID: string;
  status: ReplyStatus;
  steps: ReplyStep[];
  error?: ReplyError;
  interruptReason?: string;
  /** Background subagents that finished during this turn and woke the main agent again. */
  notices?: ReplyNotice[];
};

export const initialReply = (sessionID: string): ReplyState => ({ sessionID, status: 'idle', steps: [] });

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const int = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
/** A `{id, providerID, variant?}` model reference, or undefined when malformed. */
function parseStepModel(value: unknown): StepModel | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.providerID !== 'string') return undefined;
  const variant = str(value.variant);
  return { providerID: value.providerID, modelID: value.id, ...(variant ? { variant } : {}) };
}

function parseTokens(value: unknown): StepTokens | undefined {
  if (!isRecord(value)) return undefined;
  const output = num(value.output);
  const reasoning = num(value.reasoning);
  if (output === undefined && reasoning === undefined) return undefined;
  return { output: Math.max(0, output ?? 0), reasoning: Math.max(0, reasoning ?? 0) };
}

const phaseOf = (native: unknown): TextPhase | undefined => {
  const phase = isRecord(native) ? native.phase : undefined;
  return phase === 'commentary' || phase === 'final_answer' ? phase : undefined;
};

export function parseError(value: unknown): ReplyError {
  const e = isRecord(value) ? value : {};
  return { type: str(e.type) ?? 'unknown', message: str(e.message) ?? 'The model request failed.' };
}

/** A failed call's message, and whether the failure was the turn being interrupted. */
function toolError(value: unknown): Pick<ReplyToolPart, 'error' | 'aborted'> {
  const error = parseError(value);
  return error.type === 'aborted' ? { error: error.message, aborted: true } : { error: error.message };
}

/** Tool content from the wire: text and file items, anything else dropped. */
function parseContent(value: unknown): ToolContent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ToolContent[] => {
    if (!isRecord(item)) return [];
    if (item.type === 'text' && typeof item.text === 'string') return [{ type: 'text', text: item.text }];
    if (item.type === 'file' && typeof item.uri === 'string' && typeof item.mime === 'string') {
      return [{ type: 'file', uri: item.uri, mime: item.mime, ...(typeof item.name === 'string' ? { name: item.name } : {}) }];
    }
    return [];
  });
}

/** A tool's input JSON as an object; anything else (still streaming, not an object) is empty. */
function parseInput(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

const textPartID = (stepID: string, kind: ReplyTextPart['kind'], ordinal: number) => `${stepID}:${kind}:${ordinal}`;

function updateStep(state: ReplyState, id: string, update: (step: ReplyStep) => ReplyStep): ReplyState {
  const index = state.steps.findIndex((s) => s.id === id);
  if (index === -1) return { ...state, steps: [...state.steps, update({ id, parts: [] })] };
  const step = state.steps[index]!;
  const next = update(step);
  return next === step ? state : { ...state, steps: state.steps.map((s, i) => (i === index ? next : s)) };
}

function replacePart(step: ReplyStep, part: ReplyPart, next: ReplyPart): ReplyStep {
  return next === part ? step : { ...step, parts: step.parts.map((p) => (p === part ? next : p)) };
}

function updateText(
  step: ReplyStep,
  kind: ReplyTextPart['kind'],
  ordinal: number,
  update: (part: ReplyTextPart) => ReplyTextPart,
): ReplyStep {
  const id = textPartID(step.id, kind, ordinal);
  const existing = step.parts.find((p): p is ReplyTextPart => p.kind === kind && p.id === id);
  if (!existing) return { ...step, parts: [...step.parts, update({ kind, id, ordinal, text: '', done: false })] };
  return replacePart(step, existing, update(existing));
}

function updateTool(step: ReplyStep, id: string, update: (part: ReplyToolPart) => ReplyToolPart): ReplyStep {
  const existing = step.parts.find((p): p is ReplyToolPart => p.kind === 'tool' && p.id === id);
  return existing ? replacePart(step, existing, update(existing)) : step;
}

type Data = Record<string, unknown>;
type Context = { messageID: string | undefined; created: number | undefined };
type Handler = (state: ReplyState, d: Data, c: Context) => ReplyState;


const onStep =
  (update: (step: ReplyStep, d: Data, c: Context) => ReplyStep): Handler =>
  (state, d, c) =>
    c.messageID ? updateStep(state, c.messageID, (step) => update(step, d, c)) : state;

const textHandler = (
  kind: ReplyTextPart['kind'],
  update: (part: ReplyTextPart, d: Data, c: Context) => ReplyTextPart,
): Handler =>
  onStep((step, d, c) => {
    const ordinal = int(d.ordinal);
    return ordinal === undefined ? step : updateText(step, kind, ordinal, (part) => update(part, d, c));
  });

const textStarted = (part: ReplyTextPart, _d: Data, c: Context): ReplyTextPart =>
  part.started !== undefined || c.created === undefined ? part : { ...part, started: c.created };

const textDelta = (part: ReplyTextPart, d: Data, c: Context): ReplyTextPart => {
  const delta = str(d.delta);
  if (!delta) return part;
  return { ...textStarted(part, d, c), text: part.text + delta };
};

const textEnded = (part: ReplyTextPart, d: Data, c: Context): ReplyTextPart => {
  const phase = phaseOf(d.native);
  return {
    ...textStarted(part, d, c),
    text: str(d.text) ?? part.text,
    done: true,
    ...(phase ? { phase } : {}),
    ...(c.created !== undefined ? { ended: c.created } : {}),
  };
};

const toolHandler = (update: (part: ReplyToolPart, d: Data, c: Context) => ReplyToolPart): Handler =>
  onStep((step, d, c) => {
    const id = str(d.id);
    return id ? updateTool(step, id, (part) => update(part, d, c)) : step;
  });

const toolInputStarted: Handler = onStep((step, d, c) => {
  const id = str(d.id);
  const name = str(d.name);
  if (!id || !name || step.parts.some((p) => p.kind === 'tool' && p.id === id)) return step;
  const part: ReplyToolPart = {
    kind: 'tool',
    id,
    name,
    status: 'streaming',
    inputText: '',
    input: {},
    metadata: {},
    content: [],
    ...(c.created !== undefined ? { started: c.created } : {}),
  };
  return { ...step, parts: [...step.parts, part] };
});

/** Merges a metadata object (anything else is ignored: plugin tools send untyped metadata). */
const withMetadata = (part: ReplyToolPart, value: unknown): ReplyToolPart =>
  isRecord(value) ? { ...part, metadata: { ...part.metadata, ...value } } : part;

const ended = (c: Context) => (c.created !== undefined ? { ended: c.created } : {});

/** A (re)started step: a retry restarts the same message, so its earlier timings no longer apply. */
const stepStarted = onStep((step, d, c) => {
  const { streamed: _streamed, completed: _completed, tokens: _tokens, ...rest } = step;
  const agent = str(d.agent);
  const model = parseStepModel(d.model);
  const created = num(d.started) ?? c.created;
  return {
    ...rest,
    ...(agent ? { agent } : {}),
    ...(model ? { model } : {}),
    ...(created !== undefined ? { created } : {}),
  };
});

const stepStreamed = onStep((step, _d, c) => (c.created === undefined ? step : { ...step, streamed: c.created }));

/** A step that ended or failed: its end time, and its token usage when reported. */
const stepEnded = (step: ReplyStep, d: Data, c: Context): ReplyStep => {
  const tokens = parseTokens(d.tokens);
  return {
    ...step,
    ...(c.created !== undefined ? { completed: c.created } : {}),
    ...(tokens ? { tokens } : {}),
  };
};

const HANDLERS: Record<string, Handler> = {
  'session.execution.started': (state) => ({ ...state, status: 'running' }),
  'session.execution.succeeded': (state) => ({ ...state, status: 'succeeded' }),
  'session.execution.failed': (state, d) => ({ ...state, status: 'failed', error: parseError(d.error) }),
  'session.execution.interrupted': (state, d) => ({ ...state, status: 'interrupted', interruptReason: str(d.reason) }),
  'session.step.started': stepStarted,
  'session.step.streamed': stepStreamed,
  'session.step.ended': onStep(stepEnded),
  'session.step.failed': onStep((step, d, c) => ({ ...stepEnded(step, d, c), error: parseError(d.error).message })),
  'session.text.started': textHandler('text', textStarted),
  'session.text.delta': textHandler('text', textDelta),
  'session.text.ended': textHandler('text', textEnded),
  'session.reasoning.started': textHandler('reasoning', textStarted),
  'session.reasoning.delta': textHandler('reasoning', textDelta),
  'session.reasoning.ended': textHandler('reasoning', textEnded),
  'session.tool.input.started': toolInputStarted,
  'session.tool.input.delta': toolHandler((part, d) => {
    const delta = str(d.delta);
    return delta && part.status === 'streaming' ? { ...part, inputText: part.inputText + delta } : part;
  }),
  'session.tool.input.ended': toolHandler((part, d) => {
    const text = str(d.text) ?? part.inputText;
    return { ...part, inputText: text, input: parseInput(text) };
  }),
  'session.tool.called': toolHandler((part, d) => ({
    ...part,
    status: part.status === 'streaming' ? 'running' : part.status,
    input: isRecord(d.input) ? d.input : part.input,
  })),
  'session.tool.progress': toolHandler((part, d) => withMetadata(part, d.metadata)),
  'session.tool.success': toolHandler((part, d, c) => ({
    ...withMetadata(part, d.metadata),
    status: 'completed',
    content: parseContent(d.content),
    ...ended(c),
  })),
  'session.tool.failed': toolHandler((part, d, c) => ({
    ...withMetadata(part, d.metadata),
    status: 'error',
    ...toolError(d.error),
    content: parseContent(d.content),
    ...ended(c),
  })),
};

export function reduceReply(state: ReplyState, event: ServerEvent): ReplyState {
  const d: Data = event.data ?? {};
  if (d.sessionID !== state.sessionID) return state;
  const handler = Object.hasOwn(HANDLERS, event.type) ? HANDLERS[event.type] : undefined;
  return handler ? handler(state, d, { messageID: str(d.assistantMessageID), created: event.created }) : state;
}

/** Every part of the reply, in order. */
export const replyParts = (state: ReplyState): ReplyPart[] => state.steps.flatMap((s) => s.parts);

const joinParts = (state: ReplyState, kind: ReplyTextPart['kind']) =>
  replyParts(state)
    .filter((p): p is ReplyTextPart => p.kind === kind && p.text !== '')
    .map((p) => p.text)
    .join('\n\n');

export const replyText = (state: ReplyState) => joinParts(state, 'text');
export const replyReasoning = (state: ReplyState) => joinParts(state, 'reasoning');

// ─── Snapshots (GET .../message) ─────────────────────────────────────────

const SNAPSHOT_STATUSES: readonly ToolStatus[] = ['streaming', 'running', 'completed', 'error'];

/** A part's `time` as the `started` / `ended` fields it reports. */
function timeFields(value: unknown): { started?: number; ended?: number } {
  const time = isRecord(value) ? value : {};
  const started = num(time.created);
  const ended = num(time.completed);
  return { ...(started !== undefined ? { started } : {}), ...(ended !== undefined ? { ended } : {}) };
}

/** A streaming call's input is its raw text so far; any other state holds the parsed object. */
function snapshotInputText(state: Record<string, unknown>): string {
  if (state.status === 'streaming') return str(state.input) ?? '';
  return isRecord(state.input) ? JSON.stringify(state.input) : '';
}

function snapshotTool(part: Record<string, unknown>): ReplyToolPart | null {
  if (typeof part.id !== 'string' || typeof part.name !== 'string') return null;
  const state = isRecord(part.state) ? part.state : {};
  const status = SNAPSHOT_STATUSES.find((s) => s === state.status) ?? 'running';
  return {
    kind: 'tool',
    id: part.id,
    name: part.name,
    status,
    inputText: snapshotInputText(state),
    input: isRecord(state.input) ? state.input : {},
    metadata: isRecord(state.metadata) ? state.metadata : {},
    content: parseContent(state.content),
    ...(status === 'error' ? toolError(state.error) : {}),
    ...timeFields(part.time),
  };
}

function snapshotText(step: ReplyStep, part: Record<string, unknown>, kind: ReplyTextPart['kind']): ReplyTextPart | null {
  if (typeof part.text !== 'string') return null;
  const ordinal = step.parts.filter((p) => p.kind === kind).length;
  const phase = phaseOf(part.native);
  return {
    kind,
    id: textPartID(step.id, kind, ordinal),
    ordinal,
    text: part.text,
    done: true,
    ...(phase ? { phase } : {}),
    ...timeFields(part.time),
  };
}

function snapshotPart(step: ReplyStep, part: unknown): ReplyPart | null {
  if (!isRecord(part)) return null;
  if (part.type === 'text' || part.type === 'reasoning') return snapshotText(step, part, part.type);
  if (part.type === 'tool') return snapshotTool(part);
  return null;
}

/** One reply step rebuilt from an `assistant` message in a GET .../message snapshot. */
export function snapshotStep(message: Record<string, unknown> & { id: string }): ReplyStep {
  const step: ReplyStep = { id: message.id, parts: [] };
  if (Array.isArray(message.content)) {
    for (const item of message.content) {
      const part = snapshotPart(step, item);
      if (part) step.parts.push(part);
    }
  }
  if (isRecord(message.error)) step.error = parseError(message.error).message;
  return { ...step, ...snapshotStepMeta(message) };
}

/** A snapshot message's agent, model, timings and token usage. */
function snapshotStepMeta(message: Record<string, unknown>): Omit<ReplyStep, 'id' | 'parts' | 'error'> {
  const agent = str(message.agent);
  const model = parseStepModel(message.model);
  const time = isRecord(message.time) ? message.time : {};
  const created = num(time.created);
  const streamed = num(time.streamed);
  const completed = num(time.completed);
  const tokens = parseTokens(message.tokens);
  return {
    ...(agent ? { agent } : {}),
    ...(model ? { model } : {}),
    ...(created !== undefined ? { created } : {}),
    ...(streamed !== undefined ? { streamed } : {}),
    ...(completed !== undefined ? { completed } : {}),
    ...(tokens ? { tokens } : {}),
  };
}
