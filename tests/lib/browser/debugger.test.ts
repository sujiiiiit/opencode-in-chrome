import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEBUGGER_IDLE_MS, DebuggerSessions, type DebuggerApi, type DebuggerTarget } from '@/lib/browser/debugger';
import { codeOf } from '../../support/fake-chrome';

class FakeDebugger implements DebuggerApi {
  attached = new Set<number>();
  commands: Array<{ target: DebuggerTarget; method: string; params?: object }> = [];
  attachError: string | undefined;
  respond: (method: string, params?: object) => unknown = () => ({});
  private eventCbs: Array<(s: DebuggerTarget, m: string, p?: object) => void> = [];
  private detachCbs: Array<(s: { tabId?: number }, r: string) => void> = [];
  onEvent = { addListener: (cb: (s: DebuggerTarget, m: string, p?: object) => void) => void this.eventCbs.push(cb) };
  onDetach = { addListener: (cb: (s: { tabId?: number }, r: string) => void) => void this.detachCbs.push(cb) };

  async attach(target: { tabId: number }) {
    if (this.attachError) throw new Error(this.attachError);
    this.attached.add(target.tabId);
  }
  async detach(target: { tabId: number }) {
    this.attached.delete(target.tabId);
  }
  async sendCommand(target: DebuggerTarget, method: string, params?: object) {
    if (!this.attached.has(target.tabId)) throw new Error('Debugger is not attached to the tab with id: ' + target.tabId);
    this.commands.push({ target, method, params });
    return this.respond(method, params);
  }
  emit(source: DebuggerTarget, method: string, params: object) {
    for (const cb of this.eventCbs) cb(source, method, params);
  }
  userCancels(tabId: number) {
    this.attached.delete(tabId);
    for (const cb of this.detachCbs) cb({ tabId }, 'canceled_by_user');
  }
}

let api: FakeDebugger;
let now = 0;
let sessions: DebuggerSessions;
beforeEach(() => {
  api = new FakeDebugger();
  now = 1_000;
  sessions = new DebuggerSessions(api, () => now);
});

describe('DebuggerSessions', () => {
  it('attaches once, enables the domains and flat auto-attach', async () => {
    await Promise.all([sessions.ensure(5), sessions.ensure(5)]);
    expect(api.commands.map((c) => c.method)).toEqual([
      'Page.enable',
      'Runtime.enable',
      'Network.enable',
      'Log.enable',
      'Target.setAutoAttach',
    ]);
    expect(api.commands.at(-1)!.params).toEqual({ autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  });

  it('sends commands to child sessions and repeats auto-attach inside them', async () => {
    await sessions.ensure(5);
    api.emit({ tabId: 5 }, 'Target.attachedToTarget', {
      sessionId: 'S1',
      targetInfo: { targetId: 'T1', type: 'iframe', url: 'https://other.test/' },
    });
    await vi.waitFor(() => expect(api.commands.filter((c) => c.target.sessionId === 'S1')).toHaveLength(5));
    expect(sessions.children(5)).toEqual([{ sessionId: 'S1', targetId: 'T1', type: 'iframe', url: 'https://other.test/' }]);
    await sessions.send(5, 'Runtime.evaluate', { expression: '1' }, { sessionId: 'S1' });
    expect(api.commands.at(-1)).toMatchObject({ target: { tabId: 5, sessionId: 'S1' }, method: 'Runtime.evaluate' });
    api.emit({ tabId: 5 }, 'Target.detachedFromTarget', { sessionId: 'S1' });
    expect(sessions.children(5)).toEqual([]);
  });

  it('fans events out with their tab and session', async () => {
    await sessions.ensure(5);
    const seen = vi.fn();
    sessions.subscribe(seen);
    api.emit({ tabId: 5, sessionId: 'S2' }, 'Runtime.consoleAPICalled', { type: 'log' });
    api.emit({ tabId: 99 }, 'Runtime.consoleAPICalled', { type: 'log' });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ tabId: 5, sessionId: 'S2', method: 'Runtime.consoleAPICalled', params: { type: 'log' } });
  });

  it('explains a DevTools conflict and restricted pages', async () => {
    api.attachError = 'Another debugger is already attached to the tab with id: 5.';
    await expect(sessions.ensure(5)).rejects.toThrow(/close DevTools/);
    api.attachError = 'Cannot access a chrome:// URL';
    expect(await codeOf(sessions.ensure(6))).toBe('RESTRICTED_PAGE');
    expect(sessions.isAttached(5)).toBe(false);
  });

  it('does not re-attach automatically after the user cancels, but a tool call can', async () => {
    const detached = vi.fn();
    sessions.onDetach(detached);
    await sessions.ensure(5);
    api.userCancels(5);
    expect(detached).toHaveBeenCalledWith(5, 'canceled_by_user');
    await sessions.ensure(5, false);
    expect(api.attached.has(5)).toBe(false);
    await sessions.ensure(5, true);
    expect(api.attached.has(5)).toBe(true);
  });

  it('maps a lost attachment to DEBUGGER_DETACHED and a hang to TIMEOUT', async () => {
    await sessions.ensure(5);
    api.attached.delete(5);
    expect(await codeOf(sessions.send(5, 'Page.reload'))).toBe('DEBUGGER_DETACHED');
    await sessions.ensure(6);
    api.respond = () => new Promise(() => undefined);
    expect(await codeOf(sessions.send(6, 'Page.captureScreenshot', {}, { timeoutMs: 20 }))).toBe('TIMEOUT');
  });

  it('detaches idle tabs on sweep', async () => {
    await sessions.ensure(5);
    await sessions.ensure(6);
    now += DEBUGGER_IDLE_MS - 1;
    await sessions.ensure(6); // used again
    now += 2;
    expect(await sessions.sweep()).toEqual([5]);
    expect(api.attached).toEqual(new Set([6]));
  });

  it('keeps active commands and explicit recordings attached until they finish', async () => {
    let finish!: () => void;
    api.respond = (method) => method === 'Runtime.evaluate' ? new Promise<void>((resolve) => { finish = resolve; }) : {};
    const command = sessions.send(5, 'Runtime.evaluate');
    await vi.waitFor(() => expect(finish).toBeDefined());
    now += DEBUGGER_IDLE_MS + 1;
    expect(await sessions.sweep()).toEqual([]);
    finish();
    await command;
    await sessions.startRecording(5);
    now += DEBUGGER_IDLE_MS + 1;
    expect(await sessions.sweep()).toEqual([]);
    sessions.stopRecording(5);
    now += DEBUGGER_IDLE_MS + 1;
    expect(await sessions.sweep()).toEqual([5]);
  });
});
