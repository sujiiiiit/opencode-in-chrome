// The extension's end of the standalone MCP server (mcp/server.mjs via the native host
// mcp/host.mjs): a native messaging port that serves the same guarded browser tools to any
// MCP client on this machine. Sessions from this path are always `mcp-…`, so they can never
// act as (or in the tabs of) an opencode chat session.
import type { ClientMcpTool } from '@opencode/client/mcp';
import { BROWSER_GUIDE } from './guidance';

export const NATIVE_HOST = 'com.opencode.browser';
/** Tools that only make sense inside an opencode chat (they answer through its forms). */
const CHAT_ONLY = new Set(['ask_user']);
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 60_000;
/** A closed MCP client's tabs stay this long, so the user can still look at what it left. */
const RELEASE_AFTER_MS = 5 * 60_000;

export const isMcpSession = (sessionID: string) => /^mcp-[a-z0-9-]{4,40}$/i.test(sessionID);

type Port = {
  postMessage(message: unknown): void;
  onMessage: { addListener(cb: (message: unknown) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
};

type Request = { id?: unknown; type?: unknown; sessionID?: unknown; name?: unknown; arguments?: unknown };

/** The guide for MCP clients: the tools are named without the `browser_` prefix there. */
export function mcpGuide(): string {
  return (
    BROWSER_GUIDE.replace(/browser_([a-z_]+)/g, '$1') +
    '\n\n## Over MCP\n- `ask_user` is not available here: ask the user in your own conversation, and for sign-in or a CAPTCHA tell them to do it in Chrome, then continue.'
  );
}

/** Answers one request from an MCP client. */
export async function answer(request: Request, tools: () => ReadonlyArray<ClientMcpTool>): Promise<{ result?: unknown; error?: string }> {
  if (request.type === 'guide') return { result: mcpGuide() };
  const sessionID = typeof request.sessionID === 'string' ? request.sessionID : '';
  if (!isMcpSession(sessionID)) return { error: 'Invalid session.' };
  const served = tools().filter((t) => !CHAT_ONLY.has(t.name));
  if (request.type === 'tools/list') {
    return { result: { tools: served.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) } };
  }
  if (request.type === 'tools/call') {
    const tool = served.find((t) => t.name === request.name);
    if (!tool) return { error: `Unknown tool ${String(request.name)}.` };
    const args = typeof request.arguments === 'object' && request.arguments !== null ? (request.arguments as Record<string, unknown>) : {};
    return { result: await tool.handler(args, { sessionID } as Parameters<ClientMcpTool['handler']>[1]) };
  }
  return { error: `Unknown request ${String(request.type)}.` };
}

/**
 * Keeps a port to the native host open (it keeps the worker alive while connected). Without
 * an installed host the connect fails at once; it is retried with backoff and on `ensure`.
 */
export function startNativeBridge(
  tools: () => ReadonlyArray<ClientMcpTool>,
  connect: () => Port,
  enabled: () => Promise<boolean> = async () => true,
  release: (sessionID: string) => Promise<unknown> = async () => undefined,
  releaseAfterMs = RELEASE_AFTER_MS,
) {
  let port: Port | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let delay = RETRY_MIN_MS;

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      open();
    }, delay);
    delay = Math.min(delay * 2, RETRY_MAX_MS);
  };

  /** The sessions of a client that went away: their tabs are cleaned up after a while. */
  const releasing = new Map<string, ReturnType<typeof setTimeout>>();
  const releaseLater = (sessions: unknown) => {
    for (const sessionID of Array.isArray(sessions) ? sessions : []) {
      if (typeof sessionID !== 'string' || !isMcpSession(sessionID)) continue;
      clearTimeout(releasing.get(sessionID));
      releasing.set(sessionID, setTimeout(() => void release(sessionID).catch(() => undefined), releaseAfterMs));
    }
  };

  const open = () => {
    if (port) return;
    let next: Port;
    try {
      next = connect();
    } catch {
      return schedule();
    }
    port = next;
    next.onMessage.addListener((message) => {
      const m = (message ?? {}) as Request & { type?: unknown };
      if (m.type === 'host.ready') delay = RETRY_MIN_MS;
      if (m.type === 'client.closed') return void releaseLater((m as { sessions?: unknown }).sessions);
      if (m.id === undefined) return;
      // A client that comes back (it switched browsers and returned) keeps its tabs.
      if (typeof m.sessionID === 'string') clearTimeout(releasing.get(m.sessionID));
      void enabled().then((on) => (on ? answer(m, tools) : { error: 'Browser access is turned off in the Opencode extension settings.' })).then(
        (out) => next.postMessage({ id: m.id, ...out }),
        (error: unknown) => next.postMessage({ id: m.id, error: error instanceof Error ? error.message : String(error) }),
      );
    });
    next.onDisconnect.addListener(() => {
      if (port === next) port = undefined;
      schedule();
    });
  };

  open();
  return { ensure: () => (port || timer ? undefined : open()) };
}
