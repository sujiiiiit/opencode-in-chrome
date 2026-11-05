import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createClient } from '@/lib/opencode/client';
import { WEBSEARCH_KEY, applyChoice, configFor, listProviders, loadChoice, parseChoice } from '@/lib/opencode/websearch';
import { BASE, TOKEN, WORKSPACE_WIN, jsonResponse, routeFetch } from '@/tests/support/testkit';

describe('web search choice', () => {
  it('parses stored values, falling back to the server default', () => {
    expect(parseChoice('random')).toBe('random');
    expect(parseChoice('off')).toBe('server');
    expect(parseChoice({ provider: 'tavily' })).toEqual({ provider: 'tavily' });
    expect(parseChoice({ provider: '' })).toBe('server');
    expect(parseChoice(undefined)).toBe('server');
  });

  it('writes the provider the way opencode.jsonc expects it', () => {
    expect(JSON.parse(configFor({ provider: 'exa' })).websearch).toEqual({ provider: 'exa' });
    expect(JSON.parse(configFor('random')).websearch).toEqual({ provider: 'random' });
    expect(JSON.parse(configFor('server'))).not.toHaveProperty('websearch');
  });

  it('lists the providers the server offers for the workspace', async () => {
    const fetch = routeFetch({
      'GET /api/websearch/provider': () =>
        jsonResponse({ data: [{ id: 'exa', name: 'Exa' }, { id: 5 }, { id: 'opencode', name: 'OpenCode Web Search' }] }),
    });
    const client = createClient({ baseUrl: BASE, token: TOKEN, fetch });
    expect((await listProviders(client, WORKSPACE_WIN)).map((p) => p.id)).toEqual(['exa', 'opencode']);
    expect(decodeURIComponent(fetch.calls[0]!.url.search)).toContain(WORKSPACE_WIN);
  });

  it('writes the config into the workspace and remembers the choice', async () => {
    const fetch = routeFetch({ 'POST /api/experimental/fs/write': () => jsonResponse({ data: {} }) });
    const client = createClient({ baseUrl: BASE, token: TOKEN, fetch });
    await applyChoice(client, WORKSPACE_WIN, { provider: 'tavily' });
    const write = fetch.calls[0]!;
    expect(write.url.searchParams.get('path')).toBe(WORKSPACE_WIN + String.fromCharCode(92) + 'opencode.jsonc');
    expect(JSON.parse(new TextDecoder().decode(write.init.body as Uint8Array)).websearch).toEqual({ provider: 'tavily' });
    expect((await fakeBrowser.storage.local.get(WEBSEARCH_KEY))[WEBSEARCH_KEY]).toEqual({ provider: 'tavily' });
    expect(await loadChoice()).toEqual({ provider: 'tavily' });
  });
});
