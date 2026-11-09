// Debugger sessions: attach on demand and release idle tabs unless recording. Out-of-process
// iframes are auto-attached as flat child sessions (Chrome 125+), and every CDP event is
// fanned out to subscribers with the tab and child session it came from.
import { browser } from 'wxt/browser';
import { ToolError } from './tools/registry';

export type DebuggerTarget = { tabId: number; sessionId?: string };

/** The chrome.debugger surface used here, injectable for tests. */
export type DebuggerApi = {
  attach(target: { tabId: number }, version: string): Promise<void>;
  detach(target: { tabId: number }): Promise<void>;
  sendCommand(target: DebuggerTarget, method: string, params?: object): Promise<unknown>;
  onEvent: { addListener(cb: (source: DebuggerTarget, method: string, params?: object) => void): void };
  onDetach: { addListener(cb: (source: { tabId?: number }, reason: string) => void): void };
};

export type CdpEvent = { tabId: number; sessionId?: string; method: string; params: Record<string, unknown> };
export type ChildTarget = { sessionId: string; targetId: string; type: string; url: string };

const PROTOCOL_VERSION = '1.3';
const COMMAND_TIMEOUT_MS = 10_000;
export const DEBUGGER_IDLE_MS = 5_000;
const DOMAINS = ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable'] as const;
const AUTO_ATTACH = { autoAttach: true, waitForDebuggerOnStart: false, flatten: true };

type TabSession = {
  attached: Promise<void>;
  children: Map<string, ChildTarget>;
  lastUsed: number;
  active: number;
  recording: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

export class DebuggerSessions {
  private readonly tabs = new Map<number, TabSession>();
  private readonly detaching = new Map<number, Promise<void>>();
  /** Tabs where the user dismissed the debugging bar: no automatic re-attach. */
  private readonly cancelled = new Set<number>();
  private readonly listeners = new Set<(event: CdpEvent) => void>();
  private readonly detachListeners = new Set<(tabId: number, reason: string) => void>();

  constructor(
    private readonly api: DebuggerApi,
    private readonly now: () => number = Date.now,
  ) {
    api.onEvent.addListener((source, method, params) => this.dispatch(source, method, (params ?? {}) as Record<string, unknown>));
    api.onDetach.addListener((source, reason) => {
      if (source.tabId === undefined) return;
      if (this.detaching.has(source.tabId)) return;
      const timer = this.tabs.get(source.tabId)?.timer;
      if (timer) clearTimeout(timer);
      this.tabs.delete(source.tabId);
      if (reason === 'canceled_by_user') this.cancelled.add(source.tabId);
      for (const l of this.detachListeners) l(source.tabId, reason);
    });
  }

  subscribe(listener: (event: CdpEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onDetach(listener: (tabId: number, reason: string) => void): void {
    this.detachListeners.add(listener);
  }

  isAttached(tabId: number): boolean {
    return this.tabs.has(tabId);
  }

  children(tabId: number): ChildTarget[] {
    return [...(this.tabs.get(tabId)?.children.values() ?? [])];
  }

  private dispatch(source: DebuggerTarget, method: string, params: Record<string, unknown>): void {
    const tab = this.tabs.get(source.tabId);
    if (!tab) return;
    if (method === 'Target.attachedToTarget') {
      const info = params.targetInfo as { targetId: string; type: string; url: string } | undefined;
      const sessionId = params.sessionId as string | undefined;
      if (info && sessionId) {
        tab.children.set(sessionId, { sessionId, targetId: info.targetId, type: info.type, url: info.url });
        // Auto-attach is not recursive: repeat it inside the child, and enable its domains.
        const child = { tabId: source.tabId, sessionId };
        for (const domain of DOMAINS) void this.api.sendCommand(child, domain).catch(() => undefined);
        void this.api.sendCommand(child, 'Target.setAutoAttach', AUTO_ATTACH).catch(() => undefined);
      }
    } else if (method === 'Target.detachedFromTarget') {
      tab.children.delete(params.sessionId as string);
    }
    const event: CdpEvent = { tabId: source.tabId, sessionId: source.sessionId, method, params };
    for (const l of this.listeners) l(event);
  }

  /**
   * Attach (once) and enable the domains. `explicit` is true for a tool call: it may
   * re-attach a tab whose debugging bar the user cancelled; adoption does not.
   */
  ensure(tabId: number, explicit = true): Promise<void> {
    const existing = this.tabs.get(tabId);
    if (existing) {
      existing.lastUsed = this.now();
      this.schedule(tabId, existing);
      return existing.attached;
    }
    if (!explicit && this.cancelled.has(tabId)) return Promise.resolve();
    this.cancelled.delete(tabId);
    const session: TabSession = { attached: Promise.resolve(), children: new Map(), lastUsed: this.now(), active: 0, recording: false };
    session.attached = (async () => {
      try {
        await this.detaching.get(tabId);
        await this.api.attach({ tabId }, PROTOCOL_VERSION);
      } catch (error) {
        this.tabs.delete(tabId);
        throw attachError(error);
      }
      const target = { tabId };
      for (const domain of DOMAINS) await this.api.sendCommand(target, domain).catch(() => undefined);
      // A tab in the background reports itself hidden, so mouse events never land and animation-driven pages stall.
      await this.api.sendCommand(target, 'Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined);
      await this.api.sendCommand(target, 'Target.setAutoAttach', AUTO_ATTACH).catch(() => undefined);
    })();
    this.tabs.set(tabId, session);
    void session.attached.then(() => this.schedule(tabId, session), () => undefined);
    return session.attached;
  }

  private schedule(tabId: number, session: TabSession): void {
    if (session.timer) clearTimeout(session.timer);
    if (session.active || session.recording || this.tabs.get(tabId) !== session) return;
    session.lastUsed = this.now();
    session.timer = setTimeout(() => {
      if (!session.active && !session.recording && this.tabs.get(tabId) === session) void this.detach(tabId);
    }, DEBUGGER_IDLE_MS);
  }

  async startRecording(tabId: number): Promise<void> {
    const attached = this.ensure(tabId);
    const session = this.tabs.get(tabId)!;
    session.recording = true;
    if (session.timer) clearTimeout(session.timer);
    await attached;
  }

  stopRecording(tabId: number): void {
    const session = this.tabs.get(tabId);
    if (!session) return;
    session.recording = false;
    this.schedule(tabId, session);
  }

  /** A CDP command on the tab (or one of its child sessions), with a timeout. */
  async send<T = unknown>(tabId: number, method: string, params?: object, options: { sessionId?: string; timeoutMs?: number } = {}): Promise<T> {
    const attached = this.ensure(tabId);
    const session = this.tabs.get(tabId)!;
    session.active++;
    if (session.timer) clearTimeout(session.timer);
    try {
      await attached;
      const target: DebuggerTarget = options.sessionId ? { tabId, sessionId: options.sessionId } : { tabId };
      const timeoutMs = options.timeoutMs ?? COMMAND_TIMEOUT_MS;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ToolError('TIMEOUT', `The page did not answer ${method} within ${timeoutMs / 1000} s.`)), timeoutMs);
      });
      try {
        return (await Promise.race([this.api.sendCommand(target, method, params), timeout])) as T;
      } catch (error) {
        if (error instanceof ToolError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        if (/not attached|detached|No tab with given id/i.test(message)) {
          this.tabs.delete(tabId);
          throw new ToolError('DEBUGGER_DETACHED', 'The browser stopped letting the agent control this tab. Try the call again.');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    } finally {
      session.active--;
      this.schedule(tabId, session);
    }
  }

  async detach(tabId: number): Promise<void> {
    const session = this.tabs.get(tabId);
    if (!session || !this.tabs.delete(tabId)) return;
    if (session.timer) clearTimeout(session.timer);
    const pending = session.attached.catch(() => undefined).then(() => this.api.detach({ tabId }).catch(() => undefined));
    this.detaching.set(tabId, pending);
    try {
      await pending;
    } finally {
      if (this.detaching.get(tabId) === pending) this.detaching.delete(tabId);
    }
  }

  async detachAll(): Promise<void> {
    await Promise.all([...this.tabs.keys()].map((tabId) => this.detach(tabId)));
  }

  /** Detach tabs unused for DEBUGGER_IDLE_MS (run from an alarm). Returns the tabs detached. */
  async sweep(): Promise<number[]> {
    const cutoff = this.now() - DEBUGGER_IDLE_MS;
    const idle = [...this.tabs].filter(([, s]) => !s.active && !s.recording && s.lastUsed < cutoff).map(([tabId]) => tabId);
    await Promise.all(idle.map((tabId) => this.detach(tabId)));
    return idle;
  }
}

function attachError(error: unknown): ToolError {
  const message = error instanceof Error ? error.message : String(error);
  if (/already attached/i.test(message)) {
    return new ToolError(
      'DEBUGGER_DETACHED',
      'Another debugger (probably DevTools) is attached to this tab. Ask the user to close DevTools on it, then try again.',
    );
  }
  if (/Cannot access|cannot attach|chrome:\/\//i.test(message)) {
    return new ToolError('RESTRICTED_PAGE', "The browser does not allow controlling this page. Navigate to a web page first.");
  }
  return new ToolError('DEBUGGER_DETACHED', `Could not take control of this tab (${message}). Try again.`);
}

/** chrome.debugger as a DebuggerApi. */
export function chromeDebuggerApi(): DebuggerApi {
  const d = browser.debugger;
  return {
    attach: (target, version) => d.attach(target, version),
    detach: (target) => d.detach(target),
    sendCommand: (target, method, params) => d.sendCommand(target, method, params as Record<string, unknown>),
    onEvent: d.onEvent as DebuggerApi['onEvent'],
    onDetach: d.onDetach as DebuggerApi['onDetach'],
  };
}
