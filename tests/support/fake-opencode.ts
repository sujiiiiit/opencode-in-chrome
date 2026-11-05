// A fake opencode server for bridge, approval and e2e tests. It speaks the parts of the
// 2.2.5 API the browser agent uses, with the wire shapes observed against a real server
// (design D13/D14): the client-MCP ticket route and socket, session forms, models and
// sessions. Node only (uses `ws`); never imported by extension code.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';

export const FAKE_TOKEN = '1999999999.fake_TOKEN-abc';
export const FAKE_HOME = 'C:\\Users\\tester';
/** The extension's workspace under FAKE_HOME (lib/opencode/workspace.ts). */
export const FAKE_WORKSPACE = 'C:\\Users\\tester\\.opencode-chrome\\workspace';
const SESSION_META = 'ai.opencode/sessionID';

export type McpContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };
export type McpResult = { content: McpContent[]; isError?: boolean };
export type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> };

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

/** One extension connection, from the server's side (opencode is the MCP client). */
export class ClientMcpConnection {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  tools: McpTool[] = [];
  readonly ready: Promise<void>;

  constructor(
    private readonly socket: WebSocket,
    readonly name: string,
    /** `location[directory]`: the server only offers the tools to sessions in it. */
    readonly directory: string | null,
  ) {
    socket.on('message', (raw) => {
      const message = JSON.parse(String(raw)) as { id?: number; result?: unknown; error?: { message: string } };
      if (typeof message.id !== 'number') return;
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });
    this.ready = (async () => {
      await this.request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'opencode' } });
      this.socket.send(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
      await this.refreshTools();
    })();
  }

  get open(): boolean {
    return this.socket.readyState === this.socket.OPEN;
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  async refreshTools(): Promise<McpTool[]> {
    const result = (await this.request('tools/list')) as { tools: McpTool[] };
    this.tools = result.tools;
    return this.tools;
  }

  /** A tool call as opencode makes it, attributed to `sessionID` (omit it to test NO_SESSION). */
  async callTool(sessionID: string | undefined, name: string, args: Record<string, unknown> = {}): Promise<McpResult> {
    const params = { name, arguments: args, ...(sessionID ? { _meta: { [SESSION_META]: sessionID } } : {}) };
    return (await this.request('tools/call', params)) as McpResult;
  }

  close(): void {
    this.socket.close();
  }
}

export type FakeForm = {
  id: string;
  sessionID: string;
  title: string;
  metadata?: Record<string, unknown>;
  fields: unknown[];
  state: { status: 'pending' } | { status: 'answered'; answer: Record<string, unknown> } | { status: 'cancelled'; message?: string };
};

export type FakeModel = { providerID: string; id: string; input: string[] };

export type FakeOpencodeOptions = {
  models?: FakeModel[];
  /** Model each new session uses. */
  sessionModel?: { providerID: string; id: string };
  /** Answer each created form automatically. */
  autoAnswer?: (form: FakeForm) => Record<string, unknown> | 'cancel' | undefined;
  /** Answer the experimental per-session instruction routes with 404 (an older server). */
  noInstructions?: boolean;
};

const DEFAULT_MODELS: FakeModel[] = [
  { providerID: 'kilo', id: 'kilo-auto/free', input: ['text'] },
  { providerID: 'anthropic', id: 'claude-sonnet-5-5', input: ['text', 'image'] },
];

export type FakeOpencode = Awaited<ReturnType<typeof startFakeOpencode>>;

export async function startFakeOpencode(options: FakeOpencodeOptions = {}) {
  const tickets = new Set<string>();
  const forms = new Map<string, FakeForm>();
  const connections: ClientMcpConnection[] = [];
  const connectionWaiters: Array<(connection: ClientMcpConnection) => void> = [];
  const formWaiters: Array<(form: FakeForm) => void> = [];
  const models = options.models ?? DEFAULT_MODELS;
  const sessions = new Map<string, { providerID: string; id: string }>();
  const ticketRequests: Array<{ name: string | null }> = [];
  /** Files `GET /api/fs/read/<path>` serves, by path. */
  const files = new Map<string, Uint8Array>();
  /** Per-session instruction entries: sessionID → key → value. */
  const instructions = new Map<string, Map<string, unknown>>();
  let seq = 0;

  const authorized = (req: IncomingMessage) =>
    req.headers.authorization === 'Basic ' + Buffer.from('opencode:' + FAKE_TOKEN).toString('base64');

  const send = (res: ServerResponse, status: number, body?: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  const readBody = (req: IncomingMessage) =>
    new Promise<unknown>((resolve) => {
      let text = '';
      req.on('data', (chunk) => (text += chunk));
      req.on('end', () => resolve(text ? JSON.parse(text) : undefined));
    });

  const sessionModel = (sessionID: string) =>
    sessions.get(sessionID) ?? options.sessionModel ?? { providerID: 'kilo', id: 'kilo-auto/free' };

  const handlePreflight = (req: IncomingMessage, res: ServerResponse): boolean => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,DELETE,PUT',
      });
      res.end();
      return true;
    }
    return false;
  };

  const handleTicketAndFiles = async (req: IncomingMessage, res: ServerResponse, url: URL, location: { directory: string }): Promise<boolean> => {
    const path = url.pathname;
    if (req.method === 'POST' && path === '/api/experimental/client-mcp/token') {
      ticketRequests.push({ name: url.searchParams.get('name') });
      const ticket = `tk_${++seq}_${Math.random().toString(36).slice(2)}`;
      tickets.add(ticket);
      send(res, 200, { location, data: { ticket, expires_in: 60 } });
      return true;
    }
    if (req.method === 'GET' && path === '/api/location') {
      send(res, 200, { directory: FAKE_HOME, project: { id: 'global' } });
      return true;
    }
    return false;
  };

  const handleFiles = async (req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> => {
    if (req.method === 'POST' && path === '/api/experimental/fs/write') {
      await new Promise((resolve) => req.on('end', resolve).resume());
      send(res, 200, { data: {} });
      return true;
    }
    if (req.method !== 'GET' || !path.startsWith('/api/fs/read/')) return false;
    const file = files.get(decodeURIComponent(path.slice('/api/fs/read/'.length)));
    if (!file) {
      send(res, 404, { _tag: 'FileNotFoundError', message: 'No such file' });
      return true;
    }
    res.writeHead(200, { 'content-type': 'application/octet-stream' });
    res.end(Buffer.from(file));
    return true;
  };

  const handleModelAndSession = (req: IncomingMessage, res: ServerResponse, url: URL, location: { directory: string }): boolean => {
    const path = url.pathname;
    if (req.method === 'GET' && path === '/api/model') {
      send(res, 200, {
        location,
        data: models.map((m) => ({
          id: m.id,
          modelID: m.id,
          providerID: m.providerID,
          name: m.id,
          status: 'active',
          enabled: true,
          capabilities: { input: m.input, output: ['text'], tools: true },
        })),
      });
      return true;
    }
    const sessionMatch = /^\/api\/session\/([^/]+)$/.exec(path);
    if (req.method === 'GET' && sessionMatch) {
      const sessionID = decodeURIComponent(sessionMatch[1]!);
      send(res, 200, { location, data: { id: sessionID, model: sessionModel(sessionID) } });
      return true;
    }
    return false;
  };

  const handleForms = async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> => {
    const formsMatch = /^\/api\/session\/([^/]+)\/form$/.exec(url.pathname);
    if (req.method === 'POST' && formsMatch) return createForm(req, res, formsMatch[1]!);
    return formItem(req, res, url);
  };

  const createForm = async (req: IncomingMessage, res: ServerResponse, sessionKey: string): Promise<boolean> => {
      const body = (await readBody(req)) as Omit<FakeForm, 'id' | 'state' | 'sessionID'>;
      const form: FakeForm = {
        id: `frm_${++seq}`,
        sessionID: decodeURIComponent(sessionKey),
        title: body.title,
        metadata: body.metadata,
        fields: body.fields,
        state: { status: 'pending' },
      };
      forms.set(form.id, form);
      const auto = options.autoAnswer?.(form);
      if (auto === 'cancel') form.state = { status: 'cancelled' };
      else if (auto) form.state = { status: 'answered', answer: auto };
      formWaiters.splice(0).forEach((w) => w(form));
      const { state: _state, ...info } = form;
      send(res, 200, { data: info });
      return true;
  };

  const formItem = (req: IncomingMessage, res: ServerResponse, url: URL): boolean => {
    const formMatch = /^\/api\/session\/([^/]+)\/form\/([^/]+)$/.exec(url.pathname);
    if (formMatch) {
      const form = forms.get(decodeURIComponent(formMatch[2]!));
      if (!form) {
        send(res, 404, { _tag: 'FormNotFoundError', message: 'Form not found' });
        return true;
      }
      if (req.method === 'GET') {
        send(res, 200, { data: form });
        return true;
      }
      if (req.method === 'DELETE') {
        form.state = { status: 'cancelled', message: url.searchParams.get('message') ?? undefined };
        send(res, 204);
        return true;
      }
    }
    return false;
  };

  const handleInstructions = async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> => {
    const match = /^\/api\/experimental\/session\/([^/]+)\/instructions\/entries(?:\/([^/]+))?$/.exec(url.pathname);
    if (!match) return false;
    if (options.noInstructions) {
      send(res, 404, { _tag: 'NotFound', message: 'No such route' });
      return true;
    }
    const sessionID = decodeURIComponent(match[1]!);
    const entries = instructions.get(sessionID) ?? new Map<string, unknown>();
    instructions.set(sessionID, entries);
    if (req.method === 'PUT' && match[2]) {
      entries.set(decodeURIComponent(match[2]), ((await readBody(req)) as { value?: unknown } | undefined)?.value);
      send(res, 204);
    } else if (req.method === 'GET' && !match[2]) {
      send(res, 200, { data: [...entries].map(([key, value]) => ({ key, value })) });
    } else {
      send(res, 405, { _tag: 'MethodNotAllowed', message: req.method });
    }
    return true;
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (handlePreflight(req, res)) return;
    if (!authorized(req)) return send(res, 401, { _tag: 'UnauthorizedError', message: 'Authentication required' });
    const location = { directory: url.searchParams.get('location[directory]') ?? 'C:/workspace' };
    if (await handleTicketAndFiles(req, res, url, location)) return;
    if (await handleFiles(req, res, url.pathname)) return;
    if (handleModelAndSession(req, res, url, location)) return;
    if (await handleForms(req, res, url)) return;
    if (await handleInstructions(req, res, url)) return;
    return send(res, 404, { _tag: 'NotFound', message: `No fake route for ${req.method} ${url.pathname}` });
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const ticket = url.searchParams.get('ticket') ?? '';
    if (url.pathname !== '/api/experimental/client-mcp' || !tickets.delete(ticket)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const connection = new ClientMcpConnection(
        ws,
        url.searchParams.get('name') ?? '',
        url.searchParams.get('location[directory]'),
      );
      connections.push(connection);
      void connection.ready.then(() => connectionWaiters.splice(0).forEach((w) => w(connection)));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    token: FAKE_TOKEN,
    connections,
    forms,
    files,
    instructions,
    ticketRequests,
    setSessionModel(sessionID: string, model: { providerID: string; id: string }) {
      sessions.set(sessionID, model);
    },
    /** The newest open, initialised connection, waiting for one if needed. */
    waitForConnection(timeoutMs = 10_000): Promise<ClientMcpConnection> {
      const live = [...connections].reverse().find((c) => c.open);
      if (live) return live.ready.then(() => live);
      return withTimeout(new Promise((resolve) => connectionWaiters.push(resolve)), timeoutMs, 'client-mcp connection');
    },
    waitForForm(timeoutMs = 10_000): Promise<FakeForm> {
      return withTimeout(new Promise((resolve) => formWaiters.push(resolve)), timeoutMs, 'form');
    },
    answerForm(id: string, answer: Record<string, unknown>) {
      const form = forms.get(id);
      if (form) form.state = { status: 'answered', answer };
    },
    /** Drop every socket (as a server restart would) but keep listening. */
    dropConnections() {
      for (const c of connections) c.close();
    },
    async close() {
      for (const c of connections) c.close();
      wss.close();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${what}`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: Error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
