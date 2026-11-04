import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createClient } from '@/lib/opencode/client';
import { AGENTS_MD, WORKSPACE_KEY, ensureWorkspace, workspacePath } from '@/lib/opencode/workspace';
import { BASE, HOME_WIN, TOKEN, WORKSPACE_WIN, jsonResponse, routeFetch } from '@/tests/support/testkit';

describe('workspacePath', () => {
  it('uses backslashes for Windows homes', () => {
    expect(workspacePath('C:\\Users\\sujit')).toBe('C:\\Users\\sujit\\.opencode-chrome\\workspace');
    expect(workspacePath('C:\\Users\\sujit\\')).toBe('C:\\Users\\sujit\\.opencode-chrome\\workspace');
  });

  it('uses forward slashes for POSIX homes', () => {
    expect(workspacePath('/home/sujit')).toBe('/home/sujit/.opencode-chrome/workspace');
    expect(workspacePath('/Users/sujit/')).toBe('/Users/sujit/.opencode-chrome/workspace');
  });
});

describe('ensureWorkspace', () => {
  const setup = (home = HOME_WIN) => {
    const fetch = routeFetch({
      'GET /api/location': () => jsonResponse({ directory: home, project: { id: 'global' } }),
      'POST /api/experimental/fs/write': () => jsonResponse({ data: {} }),
    });
    return { fetch, client: createClient({ baseUrl: BASE, token: TOKEN, fetch }) };
  };

  it('reads the home, writes AGENTS.md under the fixed suffix, and stores the directory', async () => {
    const { fetch, client } = setup();
    const dir = await ensureWorkspace(client, BASE);
    expect(dir).toBe(WORKSPACE_WIN);
    const write = fetch.calls.find((c) => c.url.pathname === '/api/experimental/fs/write')!;
    expect(write.url.searchParams.get('path')).toBe(`${WORKSPACE_WIN}\\AGENTS.md`);
    expect(new TextDecoder().decode(write.init.body as Uint8Array)).toBe(AGENTS_MD);
    const stored = await fakeBrowser.storage.local.get(WORKSPACE_KEY);
    expect(stored[WORKSPACE_KEY]).toEqual({ baseUrl: BASE, directory: WORKSPACE_WIN });
  });

  it('writes with a POSIX separator for POSIX homes', async () => {
    const { fetch, client } = setup('/home/sujit');
    await ensureWorkspace(client, BASE);
    const write = fetch.calls.find((c) => c.url.pathname === '/api/experimental/fs/write')!;
    expect(write.url.searchParams.get('path')).toBe('/home/sujit/.opencode-chrome/workspace/AGENTS.md');
  });

  it('is a no-op the second time for the same server', async () => {
    const { fetch, client } = setup();
    await ensureWorkspace(client, BASE);
    const n = fetch.calls.length;
    expect(await ensureWorkspace(client, BASE)).toBe(WORKSPACE_WIN);
    expect(fetch.calls).toHaveLength(n);
  });

  it('rejects a malformed /api/location response', async () => {
    const fetch = routeFetch({ 'GET /api/location': () => jsonResponse({ directory: 5 }) });
    const client = createClient({ baseUrl: BASE, token: TOKEN, fetch });
    await expect(ensureWorkspace(client, BASE)).rejects.toThrow();
  });
});
