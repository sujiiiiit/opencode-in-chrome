import { describe, expect, it, vi } from 'vitest';
import { answer, isMcpSession, mcpGuide, startNativeBridge } from '@/lib/browser/native';

const tool = (name: string) => ({ name, description: name, inputSchema: { type: 'object' }, handler: vi.fn(async () => ({ content: [{ type: 'text' as const, text: `ran ${name}` }] })) });

describe('native bridge requests', () => {
  const tools = [tool('read_page'), tool('ask_user')];
  const list = () => tools as never;

  it('serves the tools except chat-only ones, only to mcp- sessions', async () => {
    const listed = await answer({ type: 'tools/list', sessionID: 'mcp-1a2b3c4d' }, list);
    expect((listed.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name)).toEqual(['read_page']);
    expect(await answer({ type: 'tools/list', sessionID: 'ses_opencode' }, list)).toEqual({ error: 'Invalid session.' });
    expect(isMcpSession('mcp-1a2b3c4d')).toBe(true);
  });

  it('calls a tool with the session id', async () => {
    const out = await answer({ type: 'tools/call', sessionID: 'mcp-1a2b3c4d', name: 'read_page', arguments: { tabId: 3 } }, list);
    expect(out.result).toEqual({ content: [{ type: 'text', text: 'ran read_page' }] });
    expect(tools[0]!.handler).toHaveBeenCalledWith({ tabId: 3 }, { sessionID: 'mcp-1a2b3c4d' });
    expect(await answer({ type: 'tools/call', sessionID: 'mcp-1a2b3c4d', name: 'ask_user' }, list)).toEqual({ error: 'Unknown tool ask_user.' });
  });

  it('gives a guide without the browser_ prefix and without ask_user', () => {
    const guide = mcpGuide();
    expect(guide).not.toMatch(/browser_[a-z]/);
    expect(guide).toContain('`ask_user` is not available here');
  });

  it('answers over the port, and refuses when browser access is off', async () => {
    let listener: (m: unknown) => void = () => undefined;
    const posted: unknown[] = [];
    let on = true;
    startNativeBridge(list, () => ({ postMessage: (m) => posted.push(m), onMessage: { addListener: (cb) => (listener = cb) }, onDisconnect: { addListener: () => undefined } }), async () => on);
    listener({ id: '1:1', type: 'tools/call', sessionID: 'mcp-1a2b3c4d', name: 'read_page' });
    on = false;
    listener({ id: '1:2', type: 'tools/list', sessionID: 'mcp-1a2b3c4d' });
    await vi.waitFor(() => expect(posted).toHaveLength(2));
    expect(posted).toContainEqual({ id: '1:1', result: { content: [{ type: 'text', text: 'ran read_page' }] } });
    expect(posted).toContainEqual({ id: '1:2', error: 'Browser access is turned off in the Opencode extension settings.' });
  });

  it('releases the tabs of a closed client later, unless the client returns', async () => {
    vi.useFakeTimers();
    try {
      let listener: (m: unknown) => void = () => undefined;
      const release = vi.fn(async () => undefined);
      startNativeBridge(list, () => ({ postMessage: () => undefined, onMessage: { addListener: (cb) => (listener = cb) }, onDisconnect: { addListener: () => undefined } }), async () => true, release, 1000);
      listener({ type: 'client.closed', client: 1, sessions: ['mcp-1a2b3c4d', 'mcp-5e6f7a8b', 'not-a-session'] });
      listener({ id: '2:1', type: 'tools/list', sessionID: 'mcp-5e6f7a8b' });
      await vi.advanceTimersByTimeAsync(1001);
      expect(release).toHaveBeenCalledTimes(1);
      expect(release).toHaveBeenCalledWith('mcp-1a2b3c4d');
    } finally {
      vi.useRealTimers();
    }
  });
});
