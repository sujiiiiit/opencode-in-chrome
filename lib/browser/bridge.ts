// The tool bridge: keeps a client-MCP connection from the extension to the paired opencode
// server so its models can call the browser tools (spec browser/tool-bridge, design D1/D3).
// opencode is the MCP client; we answer `tools/list` and `tools/call` over its WebSocket.
//
// `connectClientMcp` reconnects with one fixed URL, but a ticket is single-use, so we own
// reconnection: when a socket closes we dispose that connection and open a fresh one with
// a new ticket, backing off from 500 ms to 10 s.
import { connectClientMcp, type ClientMcpConnection, type ClientMcpTool } from '@opencode/client/mcp';
import { createClient, isUnauthorized } from '../opencode/client';
import { loadConnection, tokenExpiry, type Connection } from '../opencode/connection';
import { ensureWorkspace } from '../opencode/workspace';

/** Tools reach models as `<name>_<tool>` (or `tools.<name>.<tool>` in code mode). */
const BRIDGE_NAME = 'browser';
const RETRY_MIN_MS = 500;
const RETRY_MAX_MS = 10_000;

export type BridgeState = 'stopped' | 'unpaired' | 'connecting' | 'connected' | 'retrying';

export type BridgeOptions = {
  tools: () => ReadonlyArray<ClientMcpTool>;
  WebSocket?: typeof WebSocket;
  fetch?: typeof globalThis.fetch;
  loadConnection?: () => Promise<Connection | null>;
  /** The directory whose sessions get the tools (the extension's workspace by default). */
  directory?: (connection: Connection) => Promise<string>;
  now?: () => number;
  onState?: (state: BridgeState) => void;
  /** Runs before the ticket request for a server (installs the Origin rule in the extension). */
  beforeConnect?: (baseUrl: string) => Promise<void>;
};

/**
 * The socket URL `connectClientMcp` should open. It appends `api/experimental/client-mcp`
 * and keeps our query, so the single-use ticket rides in the URL. The long-lived token
 * never does (it is only sent as a header on the ticket request).
 */
export function ticketUrl(baseUrl: string, ticket: string): string {
  const url = new URL(baseUrl);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.search = '';
  url.searchParams.set('ticket', ticket);
  return url.toString();
}

export class Bridge {
  private stateValue: BridgeState = 'stopped';
  private connection: ClientMcpConnection | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private delay = RETRY_MIN_MS;
  /** Bumped on every start/stop so stale async work can tell it was superseded. */
  private generation = 0;

  constructor(private readonly options: BridgeOptions) {}

  get state(): BridgeState {
    return this.stateValue;
  }

  /** Connect unless already connecting or connected. Safe to call repeatedly (alarms, startup). */
  start(): void {
    if (this.stateValue === 'connecting' || this.stateValue === 'connected' || this.stateValue === 'retrying') return;
    this.generation += 1;
    this.delay = RETRY_MIN_MS;
    void this.open(this.generation);
  }

  async stop(): Promise<void> {
    this.generation += 1;
    clearTimeout(this.timer);
    this.timer = undefined;
    const connection = this.connection;
    this.connection = undefined;
    this.setState('stopped');
    await connection?.close();
  }

  private setState(state: BridgeState): void {
    if (this.stateValue === state) return;
    this.stateValue = state;
    this.options.onState?.(state);
  }

  private retry(generation: number): void {
    if (generation !== this.generation) return;
    this.setState('retrying');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.open(generation), this.delay);
    this.delay = Math.min(this.delay * 2, RETRY_MAX_MS);
  }

  private async open(generation: number): Promise<void> {
    if (generation !== this.generation) return;
    this.setState('connecting');
    let issued: { connection: Connection; ticket: string; directory: string } | null;
    try {
      issued = await this.issueTicket();
    } catch (error) {
      if (generation !== this.generation) return;
      if (isUnauthorized(error)) return this.setState('unpaired');
      return this.retry(generation);
    }
    if (!issued) {
      if (generation === this.generation) this.setState('unpaired');
      return;
    }
    if (generation !== this.generation) return;
    const { connection, ticket, directory } = issued;

    const bridge = this;
    const Base = this.options.WebSocket ?? globalThis.WebSocket;
    let current: ClientMcpConnection | undefined;
    // Watches the one socket this connection opens: `notifications/initialized` means the
    // server now lists our tools; any close hands reconnection back to us.
    class WatchedSocket extends Base {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener('message', (event: MessageEvent) => {
          if (typeof event.data === 'string' && event.data.includes('"notifications/initialized"')) {
            if (generation !== bridge.generation) return;
            bridge.delay = RETRY_MIN_MS;
            bridge.setState('connected');
          }
        });
        this.addEventListener('close', () => {
          void current?.close();
          if (bridge.connection === current) bridge.connection = undefined;
          bridge.retry(generation);
        });
      }
    }

    current = connectClientMcp({
      url: ticketUrl(connection.baseUrl, ticket),
      name: BRIDGE_NAME,
      directory,
      tools: this.options.tools(),
      WebSocket: WatchedSocket,
    });
    this.connection = current;
  }

  private async issueTicket(): Promise<{ connection: Connection; ticket: string; directory: string } | null> {
    const connection = await (this.options.loadConnection ?? loadConnection)();
    if (!connection || tokenExpiry(connection.token) <= (this.options.now ?? Date.now)()) return null;
    await this.options.beforeConnect?.(connection.baseUrl);
    const client = createClient({ baseUrl: connection.baseUrl, token: connection.token, fetch: this.options.fetch });
    const directory = await (this.options.directory ?? ((c) => ensureWorkspace(client, c.baseUrl)))(connection);
    const issued = await client.experimental.mcp.client.token({
      name: BRIDGE_NAME,
      'x-opencode-ticket': '1',
      location: { directory },
    });
    return { connection, ticket: issued.data.ticket, directory };
  }
}
