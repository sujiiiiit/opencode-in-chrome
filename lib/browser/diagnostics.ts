// Console and network capture (spec browser/page-diagnostics) from the CDP events of each
// agent tab's debugger session, kept in memory from the moment the tab joined a session.
import type { CdpEvent, DebuggerSessions } from './debugger';
import { ToolError } from './tools/registry';

const MAX_CONSOLE = 1000;
const MAX_REQUESTS = 500;

type ConsoleEntry = { time: number; level: string; text: string; stack?: string };

type RemoteObject = { type?: string; subtype?: string; value?: unknown; description?: string; unserializableValue?: string };
type CallFrame = { functionName?: string; url?: string; lineNumber?: number; columnNumber?: number };

function formatArg(arg: RemoteObject): string {
  if (arg.type === 'string') return String(arg.value);
  if (arg.unserializableValue) return arg.unserializableValue;
  if (arg.type === 'undefined') return 'undefined';
  if (arg.value !== undefined) return typeof arg.value === 'object' ? JSON.stringify(arg.value) : String(arg.value);
  return arg.description ?? arg.type ?? '';
}

function firstFrame(frames: CallFrame[] | undefined): string | undefined {
  const f = frames?.[0];
  if (!f) return undefined;
  return `at ${f.functionName || '(anonymous)'} (${f.url ?? ''}:${(f.lineNumber ?? 0) + 1}:${(f.columnNumber ?? 0) + 1})`;
}

function consolePattern(pattern: string | undefined): RegExp | undefined {
  if (!pattern) return undefined;
  try {
    return new RegExp(pattern, 'i');
  } catch {
    throw new ToolError('INVALID_INPUT', `\`pattern\` is not a valid regular expression: ${pattern}`);
  }
}

function formatConsoleEntry(entry: ConsoleEntry, index: number): string {
  const time = new Date(entry.time).toTimeString().slice(0, 8);
  return `[${index + 1}] ${time} ${entry.level} ${entry.text}${entry.stack ? `\n    ${entry.stack}` : ''}`;
}

/** The site of a URL for "same site" checks: hostname without a leading www. */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export class ConsoleLog {
  private readonly tabs = new Map<number, { site: string; entries: ConsoleEntry[] }>();

  constructor(debuggers: DebuggerSessions, private readonly now: () => number = Date.now) {
    debuggers.subscribe((event) => this.onEvent(event));
    debuggers.onDetach((tabId) => this.tabs.delete(tabId));
  }

  private push(tabId: number, entry: ConsoleEntry): void {
    const tab = this.tabs.get(tabId) ?? { site: '', entries: [] };
    tab.entries.push(entry);
    if (tab.entries.length > MAX_CONSOLE) tab.entries.splice(0, tab.entries.length - MAX_CONSOLE);
    this.tabs.set(tabId, tab);
  }

  onEvent(event: CdpEvent): void {
    if (event.method === 'Runtime.consoleAPICalled') return this.onConsole(event);
    if (event.method === 'Runtime.exceptionThrown') return this.onException(event);
    if (event.method === 'Log.entryAdded') return this.onLogEntry(event);
    if (event.method === 'Page.frameNavigated' && !event.sessionId) this.onNavigation(event);
  }

  private onConsole(event: CdpEvent): void {
    const p = event.params;
      const args = (p.args as RemoteObject[] | undefined) ?? [];
      const type = String(p.type ?? 'log');
      const level = type === 'warning' ? 'WARN' : type === 'error' || type === 'assert' ? 'ERROR' : type.toUpperCase();
      const stack = level === 'ERROR' ? firstFrame((p.stackTrace as { callFrames?: CallFrame[] } | undefined)?.callFrames) : undefined;
      this.push(event.tabId, { time: this.now(), level, text: args.map(formatArg).join(' '), stack });
  }

  private onException(event: CdpEvent): void {
    const p = event.params;
      const d = (p.exceptionDetails ?? {}) as { text?: string; exception?: RemoteObject; stackTrace?: { callFrames?: CallFrame[] } };
      const description = d.exception?.description?.split('\n')[0] ?? d.text ?? 'Uncaught exception';
      this.push(event.tabId, { time: this.now(), level: 'ERROR', text: description, stack: firstFrame(d.stackTrace?.callFrames) });
  }

  private onLogEntry(event: CdpEvent): void {
    const p = event.params;
      const entry = (p.entry ?? {}) as { level?: string; text?: string; url?: string };
      const level = entry.level === 'warning' ? 'WARN' : (entry.level ?? 'info').toUpperCase();
      this.push(event.tabId, { time: this.now(), level, text: `${entry.text ?? ''}${entry.url ? ` (${entry.url})` : ''}` });
  }

  private onNavigation(event: CdpEvent): void {
    const p = event.params;
      const frame = (p.frame ?? {}) as { parentId?: string; url?: string };
      if (frame.parentId) return;
      const site = siteOf(frame.url ?? '');
      const tab = this.tabs.get(event.tabId);
      if (tab && tab.site && tab.site !== site) tab.entries = [];
      this.tabs.set(event.tabId, { site, entries: tab?.entries ?? [] });
  }

  read(tabId: number, options: { pattern?: string; onlyErrors?: boolean; limit?: number; clear?: boolean }): string {
    const regex = consolePattern(options.pattern);
    const tab = this.tabs.get(tabId);
    const all = tab?.entries ?? [];
    const matching = all.filter((e) => matchesConsole(e, options.onlyErrors, regex));
    const limit = options.limit ?? 100;
    const shown = matching.slice(-limit);
    if (options.clear && tab) tab.entries = all.filter((e) => !shown.includes(e));
    return consoleReadText(all.length, matching.length, shown);
  }
}

function matchesConsole(entry: ConsoleEntry, onlyErrors: boolean | undefined, regex: RegExp | undefined): boolean {
  return (!onlyErrors || entry.level === 'ERROR') && (!regex || regex.test(entry.text));
}

function consoleReadText(total: number, matching: number, shown: ConsoleEntry[]): string {
  if (shown.length === 0) return matching === 0 && total > 0 ? 'No console messages match.' : 'No console messages from this site yet.';
  const more = matching > shown.length ? `\n(${matching - shown.length} earlier messages not shown; raise limit)` : '';
  return `${shown.map(formatConsoleEntry).join('\n')}${more}`;
}

type NetworkEntry = {
  id: string;
  requestId: string;
  sessionId?: string;
  method: string;
  url: string;
  type: string;
  status?: number;
  mime?: string;
  size?: number;
  start: number;
  end?: number;
  error?: string;
};

function networkEntry(next: number, event: CdpEvent, request: { method?: string }, url: string): NetworkEntry {
  return {
    id: `r${next}`,
    requestId: String(event.params.requestId),
    sessionId: event.sessionId,
    method: request.method ?? 'GET',
    url,
    type: String(event.params.type ?? 'Other').toLowerCase(),
    start: Number(event.params.timestamp ?? 0),
  };
}

const SKIPPED_URL = /^(data:|blob:|chrome-extension:|chrome:|devtools:|about:)/i;
const TEXT_MIME = /^(text\/|application\/(json|javascript|xml|x-www-form-urlencoded|ld\+json|graphql)|image\/svg)/i;

export function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export class NetworkLog {
  private readonly tabs = new Map<number, { next: number; byRequest: Map<string, NetworkEntry>; entries: NetworkEntry[] }>();

  constructor(private readonly debuggers: DebuggerSessions) {
    debuggers.subscribe((event) => this.onEvent(event));
    debuggers.onDetach((tabId) => this.tabs.delete(tabId));
  }

  private tab(tabId: number) {
    let tab = this.tabs.get(tabId);
    if (!tab) {
      tab = { next: 1, byRequest: new Map(), entries: [] };
      this.tabs.set(tabId, tab);
    }
    return tab;
  }

  onEvent(event: CdpEvent): void {
    const p = event.params;
    const key = `${event.sessionId ?? ''}:${String(p.requestId ?? '')}`;
    if (event.method === 'Network.requestWillBeSent') return this.onRequest(event, key);
    const entry = this.tabs.get(event.tabId)?.byRequest.get(key);
    if (!entry) return;
    this.updateRequest(event.method, entry, p);
  }

  private updateRequest(method: string, entry: NetworkEntry, p: Record<string, unknown>): void {
    if (method === 'Network.responseReceived') this.onResponse(entry, p);
    else if (method === 'Network.loadingFinished') {
      entry.size = Number(p.encodedDataLength ?? 0);
      entry.end = Number(p.timestamp ?? entry.start);
    } else if (method === 'Network.loadingFailed') {
      entry.error = String(p.errorText ?? 'failed');
      entry.end = Number(p.timestamp ?? entry.start);
    }
  }

  private onRequest(event: CdpEvent, key: string): void {
      const p = event.params;
      const request = (p.request ?? {}) as { url?: string; method?: string };
      const url = request.url ?? '';
      if (SKIPPED_URL.test(url)) return;
      const tab = this.tab(event.tabId);
      const existing = tab.byRequest.get(key);
      if (existing) {
        // A redirect: the same request id continues with a new URL.
        existing.url = url;
        return;
      }
      const entry = networkEntry(tab.next++, event, request, url);
      tab.byRequest.set(key, entry);
      tab.entries.push(entry);
      this.trimRequests(tab);
  }

  private trimRequests(tab: ReturnType<NetworkLog['tab']>): void {
    if (tab.entries.length <= MAX_REQUESTS) return;
    const dropped = tab.entries.splice(0, tab.entries.length - MAX_REQUESTS);
    for (const d of dropped) tab.byRequest.delete(`${d.sessionId ?? ''}:${d.requestId}`);
  }

  private onResponse(entry: NetworkEntry, p: Record<string, unknown>): void {
      const response = (p.response ?? {}) as { status?: number; mimeType?: string };
      entry.status = response.status;
      entry.mime = response.mimeType;
      if (p.type) entry.type = String(p.type).toLowerCase();
  }

  read(tabId: number, options: { urlPattern?: string; limit?: number; clear?: boolean }): string {
    const tab = this.tabs.get(tabId);
    const all = tab?.entries ?? [];
    const matching = options.urlPattern ? all.filter((e) => e.url.includes(options.urlPattern!)) : all;
    const shown = matching.slice(-(options.limit ?? 100));
    if (options.clear && tab) tab.entries = all.filter((e) => !shown.includes(e));
    if (shown.length === 0) return all.length ? 'No requests match.' : 'No requests recorded for this tab yet.';
    const lines = shown.map((e) => {
      const status = e.error ? `ERR(${e.error})` : (e.status ?? 'pending');
      const ms = e.end !== undefined ? `${Math.round((e.end - e.start) * 1000)} ms` : '-';
      return `${e.id} ${e.method} ${status} ${e.type} ${formatSize(e.size)} ${ms} ${e.url}`;
    });
    return `${lines.join('\n')}\nUse request_id (e.g. ${shown.at(-1)!.id}) to read a text response body.`;
  }

  async body(tabId: number, id: string, maxChars = 20_000): Promise<string> {
    const entry = this.tabs.get(tabId)?.entries.find((e) => e.id === id);
    if (!entry) throw new ToolError('STALE_REF', `No request ${id} in this tab's log. Call network without request_id to list requests.`);
    if (entry.mime && !TEXT_MIME.test(entry.mime)) {
      throw new ToolError('INVALID_INPUT', `${id} is ${entry.mime}, not text; only text-like bodies (HTML, JSON, JS, CSS, XML) can be read.`);
    }
    let result: { body: string; base64Encoded: boolean };
    try {
      result = await this.debuggers.send(tabId, 'Network.getResponseBody', { requestId: entry.requestId }, { sessionId: entry.sessionId });
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError('STALE_REF', `The body of ${id} is no longer available (the page may have navigated or the request is still loading).`);
    }
    const text = result.base64Encoded ? atob(result.body) : result.body;
    const cut = text.length > maxChars ? `${text.slice(0, maxChars)}\n[truncated at ${maxChars} of ${text.length} chars]` : text;
    return `${entry.method} ${entry.status ?? ''} ${entry.url}\n---\n${cut}`;
  }
}
