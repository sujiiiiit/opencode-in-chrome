// The browser tool framework (design D10): each tool is a plain definition; `toMcpTools`
// wraps them for the bridge with the session check, input validation, typed errors and
// the tab footer that spec browser/tool-bridge requires of every result.
import type { ClientMcpTool, ClientMcpToolResult } from '@opencode/client/mcp';

const ERROR_CODES = [
  'NO_SESSION',
  'NO_TAB',
  'NOT_IN_GROUP',
  'RESTRICTED_PAGE',
  'STALE_REF',
  'OBSCURED',
  'NOT_INTERACTABLE',
  'TIMEOUT',
  'DIALOG_OPEN',
  'NEEDS_APPROVAL',
  'DENIED',
  'BLOCKED_SITE',
  'DEBUGGER_DETACHED',
  'INVALID_INPUT',
  'NO_EFFECT',
  'UNVERIFIED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** A failure the model can act on: the result text is `CODE: message`. */
export class ToolError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

export type JsonSchema = {
  type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  enum?: ReadonlyArray<string | number | boolean>;
  items?: JsonSchema;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  /** A value may be any of these types (`form_input` values). */
  anyOf?: JsonSchema[];
};

export type ToolImage = { data: string; mimeType: string };

export type ToolOutput = {
  /** Text parts, in order; joined with blank lines. */
  text: string[];
  images?: ToolImage[];
  /** The tab the call acted on, for the state block. */
  tabId?: number;
  /** For page actions: whether the page visibly changed (feeds verification and the no-effect guard). */
  effect?: 'changed' | 'none' | 'unknown';
};

export type ToolContext = { sessionID: string };

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: JsonSchema & { type: 'object' };
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutput>;
};

export type RegistryHooks = {
  /** The browser-state block that ends a result, or undefined when the session has no tabs. */
  footer?: (sessionID: string, tabId: number | undefined) => Promise<string | undefined>;
  /** Called before each call with a session (fire and forget): attaches the browsing guide. */
  onCall?: (sessionID: string) => void;
  /** Awaited before each call with a session (the state block notes what changed since the last call). Errors are ignored. */
  beforeCall?: (sessionID: string) => Promise<void>;
  /** Called for unexpected errors (logging); the model only sees a generic message. */
  onInternalError?: (tool: string, error: unknown) => void;
};

function errorResult(code: ErrorCode, message: string): ClientMcpToolResult {
  return { content: [{ type: 'text', text: `${code}: ${message}` }], isError: true };
}

async function errorWithFooter(code: ErrorCode, message: string, sessionID: string, hooks: RegistryHooks, args: Record<string, unknown>): Promise<ClientMcpToolResult> {
  const footer = await hooks.footer?.(sessionID, typeof args.tabId === 'number' ? args.tabId : undefined).catch(() => undefined);
  return { content: [{ type: 'text', text: `${code}: ${message}${footer ? `\n\n${footer}` : ''}` }], isError: true };
}

async function failedTool(error: unknown, def: ToolDef, sessionID: string, hooks: RegistryHooks, args: Record<string, unknown>): Promise<ClientMcpToolResult> {
  if (error instanceof ToolError) return errorWithFooter(error.code, error.message, sessionID, hooks, args);
  hooks.onInternalError?.(def.name, error);
  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  return errorWithFooter('INTERNAL', `The browser tool failed unexpectedly${detail}. Try again, or try a different approach.`, sessionID, hooks, args);
}

const typeOf = (value: unknown): string => {
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
};

function matches(schema: JsonSchema, value: unknown): boolean {
  if (schema.anyOf) return schema.anyOf.some((s) => matches(s, value));
  if (!schema.type) return true;
  const actual = typeOf(value);
  if (schema.type === 'number') return actual === 'number' || actual === 'integer';
  return actual === schema.type;
}

/** Checks required arguments, types, enums and bounds; returns the first problem found. */
export function validate(schema: JsonSchema, args: Record<string, unknown>): string | undefined {
  for (const key of schema.required ?? []) {
    if (args[key] === undefined || args[key] === null) return `Missing required argument \`${key}\`.`;
  }
  for (const [key, value] of Object.entries(args)) {
    const prop = schema.properties?.[key];
    if (!prop || value === undefined || value === null) continue;
    const problem = validateValue(key, value, prop);
    if (problem) return problem;
  }
  return undefined;
}

function validateValue(key: string, value: unknown, prop: JsonSchema): string | undefined {
  if (!matches(prop, value)) {
      const expected = prop.anyOf ? prop.anyOf.map((s) => s.type).join(' or ') : prop.type;
      return `Argument \`${key}\` must be ${expected}, got ${typeOf(value)}.`;
  }
  if (prop.enum && !prop.enum.includes(value as never)) {
      return `Argument \`${key}\` must be one of ${prop.enum.map((v) => JSON.stringify(v)).join(', ')}.`;
  }
  if (typeof value === 'number') return validateNumber(key, value, prop);
  if (Array.isArray(value)) return validateArray(key, value, prop);
  return undefined;
}

function validateNumber(key: string, value: number, prop: JsonSchema): string | undefined {
  if (prop.minimum !== undefined && value < prop.minimum) return `Argument \`${key}\` must be at least ${prop.minimum}.`;
  if (prop.maximum !== undefined && value > prop.maximum) return `Argument \`${key}\` must be at most ${prop.maximum}.`;
  return undefined;
}

function validateArray(key: string, value: unknown[], prop: JsonSchema): string | undefined {
  if (prop.minItems !== undefined && value.length < prop.minItems) return `Argument \`${key}\` needs at least ${prop.minItems} items.`;
  if (prop.maxItems !== undefined && value.length > prop.maxItems) return `Argument \`${key}\` allows at most ${prop.maxItems} items.`;
  if (prop.items && !value.every((item) => matches(prop.items!, item))) return `Every item of \`${key}\` must be ${prop.items.type}.`;
  return undefined;
}

/** Runs one tool call to a result, never throwing (the shape every tool shares). */
export async function runTool(
  def: ToolDef,
  args: Record<string, unknown>,
  sessionID: string | undefined,
  hooks: RegistryHooks = {},
): Promise<ClientMcpToolResult> {
  if (!sessionID) {
    return errorResult('NO_SESSION', 'This call did not come from a chat session, so it has no tabs. Call it from a session.');
  }
  hooks.onCall?.(sessionID);
  await hooks.beforeCall?.(sessionID).catch(() => undefined);
  const problem = validate(def.inputSchema, args);
  if (problem) return errorWithFooter('INVALID_INPUT', problem, sessionID, hooks, args);
  let output: ToolOutput;
  try {
    output = await def.handler(args, { sessionID });
  } catch (error) {
    return failedTool(error, def, sessionID, hooks, args);
  }
  const text = [...output.text];
  const footer = await hooks.footer?.(sessionID, output.tabId).catch(() => undefined);
  if (footer) text.push(footer);
  return {
    content: [
      { type: 'text', text: text.join('\n\n') },
      ...(output.images ?? []).map((image) => ({ type: 'image' as const, data: image.data, mimeType: image.mimeType })),
    ],
  };
}

export function toMcpTools(defs: readonly ToolDef[], hooks: RegistryHooks = {}): ClientMcpTool[] {
  return defs.map((def) => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema as Record<string, unknown>,
    handler: (args, ctx) => runTool(def, args, ctx.sessionID, hooks),
  }));
}

/**
 * Marks page-derived text as data, not instructions (spec browser/page-snapshot). The id
 * is random per call so page text cannot fake a closing marker.
 */
export function untrusted(text: string, random: () => string = randomId): string {
  const id = random();
  return `<untrusted_page_content id="${id}">\n${text}\n</untrusted_page_content id="${id}">`;
}

function randomId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
