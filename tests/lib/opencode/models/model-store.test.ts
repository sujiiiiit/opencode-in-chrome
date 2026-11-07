import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Connection } from '@/lib/opencode/connection';
import { EventHub } from '@/lib/opencode/events';
import { buildControls } from '@/lib/opencode/models/controls';
import { ModelStore } from '@/lib/opencode/models/model-store';
import { loadPreferences, savePreferences } from '@/lib/opencode/models/preferences';
import { loadLastChoice, loadSavedSelections } from '@/lib/opencode/models/selection';
import { fakeOpencode, type FakeOpencodeOptions } from '@/tests/support/queue-server';
import { BASE, MODELS, PROVIDERS, SESSION_ID, TOKEN, jsonResponse, modelInfo, unauthorized } from '@/tests/support/testkit';

const connection: Connection = { baseUrl: BASE, token: TOKEN, expiresAt: 1796106971000, serverVersion: '2.2.5', pairedAt: 1 };

const FLINT = { providerID: 'opencode', modelID: 'flint-40b-free' };
const OPUS = { providerID: 'anthropic', modelID: 'claude-opus-5-5' };
const SONNET = { providerID: 'anthropic', modelID: 'claude-sonnet-5-5' };

// Stored preferences outlive a store, so each test starts from empty storage.
beforeEach(() => fakeBrowser.reset());

const disposers: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

async function setup(server: FakeOpencodeOptions = {}, options: { events?: boolean; onUnauthorized?: () => void } = {}) {
  const fake = fakeOpencode(server);
  const events = options.events ? new EventHub({ connection, fetch: fake.fetch, retryMs: 0 }) : undefined;
  if (events) {
    disposers.push(() => events.dispose());
    await events.start();
  }
  const store = new ModelStore({ connection, fetch: fake.fetch, events, onUnauthorized: options.onUnauthorized });
  disposers.push(() => store.dispose());
  await store.load();
  return { fake, store };
}

const controls = (store: ModelStore) => buildControls(store.getState());
const current = (store: ModelStore) => {
  const { agent, model, variant } = store.resolved();
  return [agent?.name, model && `${model.providerID}/${model.modelID}`, variant ?? 'default'];
};

describe('ModelStore.load', () => {
  it('loads the catalog, agents and config for the workspace', async () => {
    const { fake, store } = await setup();
    const state = store.getState();
    expect(state.phase).toBe('ready');
    expect(state.agents.map((a) => a.name)).toEqual(['build', 'plan']);
    expect(state.catalog?.providers.map((p) => p.id)).toEqual(['opencode', 'anthropic']);
    for (const path of ['/api/provider', '/api/model', '/api/agent', '/api/config']) {
      const call = fake.fetch.calls.find((c) => c.url.pathname === path)!;
      expect(call.url.searchParams.get('location[directory]')).toContain('.opencode-chrome');
    }
    expect(current(store)).toEqual(['build', 'opencode/flint-40b-free', 'default']);
    expect(controls(store)).toMatchObject({ loading: false, empty: false, agent: { visible: true } });
  });

  it('reloads the catalog once when a provider is connected while the panel is open', async () => {
    let connected = false;
    const NVIDIA = { id: 'nvidia', name: 'Nvidia', activation: 'enabled', package: '@ai-sdk/openai-compatible' };
    const { fake, store } = await setup(
      {
        overrides: {
          'GET /api/provider': () =>
            jsonResponse(connected ? { ...PROVIDERS, data: [...PROVIDERS.data, NVIDIA] } : PROVIDERS),
          'GET /api/model': () =>
            jsonResponse(
              connected ? { ...MODELS, data: [...MODELS.data, modelInfo('nvidia', 'nemotron-3-ultra', 'Nemotron 3 Ultra')] } : MODELS,
            ),
        },
      },
      { events: true },
    );
    const providerCalls = () => fake.fetch.calls.filter((c) => c.url.pathname === '/api/provider').length;
    expect(providerCalls()).toBe(1);
    connected = true;
    fake.emit('credential.updated', {});
    fake.emit('integration.updated', {});
    fake.emit('provider.updated', {});
    await vi.waitFor(() => expect(store.getState().catalog?.providers.map((p) => p.id)).toContain('nvidia'));
    expect(providerCalls()).toBe(2);
  });

  it('fails, and reports a rejected token', async () => {
    const onUnauthorized = vi.fn();
    const { store } = await setup({ overrides: { 'GET /api/model': () => unauthorized() } }, { onUnauthorized });
    expect(store.getState().phase).toBe('failed');
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(controls(store).selection).toBeUndefined();
  });

  it('reports an empty catalog', async () => {
    const { store } = await setup({ overrides: { 'GET /api/model': () => jsonResponse({ data: [] }) } });
    expect(controls(store)).toMatchObject({ empty: true, selection: undefined });
  });

  it('shows a notice until it is dismissed', async () => {
    const { store } = await setup();
    store.notify('Choose a model');
    expect(store.getState().notice).toBe('Choose a model');
    store.dismissNotice();
    expect(store.getState().notice).toBeNull();
  });

  it('names the model from the cached catalog while the live one loads', async () => {
    await setup();
    let release!: () => void;
    const fake = fakeOpencode({
      overrides: { 'GET /api/model': () => new Promise((resolve) => (release = () => resolve(jsonResponse(MODELS)))) },
    });
    const store = new ModelStore({ connection, fetch: fake.fetch });
    disposers.push(() => store.dispose());
    const loading = store.load();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(controls(store)).toMatchObject({ loading: true, preview: true, model: { label: { model: 'Flint 40B Free' } } });
    expect(controls(store).selection).toBeUndefined();
    release();
    await loading;
    expect(controls(store)).toMatchObject({ loading: false, preview: false });
  });
});

describe('choosing a model and its variant', () => {
  it('starts another model from its default effort and keeps the effort when re-picking the same model', async () => {
    const { store } = await setup();
    store.setModel(OPUS, { recent: true });
    expect(current(store)).toEqual(['build', 'anthropic/claude-opus-5-5', 'default']);
    store.setVariant('high');
    store.setModel(OPUS);
    expect(current(store)[2]).toBe('high');
    store.setModel(SONNET);
    expect(current(store)[2]).toBe('default');
    // Efforts are not remembered per model.
    store.setModel(OPUS);
    expect(current(store)[2]).toBe('default');
    expect(store.getState().prefs.recent).toEqual([OPUS]);
  });

  it('cycles default → low → medium → high → default without storing a preference', async () => {
    const { store } = await setup();
    store.setModel(OPUS);
    const seen = [];
    for (let i = 0; i < 4; i++) {
      store.cycleVariant();
      seen.push(controls(store).variant.current);
    }
    expect(seen).toEqual(['low', 'medium', 'high', 'default']);
    expect(controls(store).variant.options).toEqual(['default', 'low', 'medium', 'high']);
    expect(await loadPreferences()).not.toHaveProperty('variant');
  });

  it('ignores a model the catalog does not offer and a variant without a model', async () => {
    const { store } = await setup();
    store.setModel({ providerID: 'gone', modelID: 'x' });
    expect(current(store)[1]).toBe('opencode/flint-40b-free');
    store.cycleVariant(); // Flint has no variants.
    expect(controls(store).variant.options).toEqual(['default']);
  });

  it('steps through the recent models', async () => {
    const { store } = await setup();
    store.setModel(OPUS, { recent: true });
    store.setModel(SONNET, { recent: true });
    store.cycleModel(1);
    expect(current(store)[1]).toBe('anthropic/claude-opus-5-5');
    store.cycleModel(1);
    expect(current(store)[1]).toBe('anthropic/claude-sonnet-5-5');
    store.cycleModel(-1);
    expect(current(store)[1]).toBe('anthropic/claude-opus-5-5');
  });

  it('shows a picked model in the picker and toggles favorites', async () => {
    const { store } = await setup();
    store.setVisibility([OPUS], false);
    store.setModel(OPUS);
    expect(store.getState().prefs.user).toEqual([{ ...OPUS, visibility: 'show' }]);
    store.toggleFavorite(SONNET);
    await vi.waitFor(async () => expect((await loadPreferences()).favorite).toEqual([SONNET]));
  });
});

describe('saved visibility', () => {
  it('lists every model as shown until the user hides one, and saves the choice', async () => {
    const { store } = await setup();
    const keys = (state: ReturnType<typeof store.getState>) => state.catalog!.providers.flatMap((p) => p.models);
    expect(keys(store.getState()).length).toBeGreaterThan(0);
    store.setVisibility([OPUS], false);
    await vi.waitFor(async () => expect((await loadPreferences()).user).toEqual([{ ...OPUS, visibility: 'hide' }]));
    expect(store.getState().prefs.user).toEqual([{ ...OPUS, visibility: 'hide' }]);
  });

  it('keeps a change another panel saved while this one writes its own', async () => {
    const { store } = await setup();
    await savePreferences({ user: [{ ...SONNET, visibility: 'hide' }], recent: [], favorite: [] });
    store.setVisibility([OPUS], false);
    await vi.waitFor(async () => expect((await loadPreferences()).user.map((item) => item.modelID).sort()).toEqual([OPUS.modelID, SONNET.modelID].sort()));
  });
});

describe('agents', () => {
  it('remembers each agent model and variant, and restores it on switching back', async () => {
    const { store } = await setup();
    store.setModel(OPUS);
    store.setVariant('high');
    store.setAgent('plan');
    expect(current(store)).toEqual(['plan', 'opencode/flint-40b-free', 'default']);
    store.setModel(SONNET);
    store.moveAgent(1); // plan → build
    expect(current(store)).toEqual(['build', 'anthropic/claude-opus-5-5', 'high']);
    store.moveAgent(-1);
    expect(current(store)).toEqual(['plan', 'anthropic/claude-sonnet-5-5', 'default']);
  });
});

describe('agent allowlist', () => {
  it('offers only the allowed agents, keeping the first agent when none of them exist', async () => {
    const fake = fakeOpencode();
    const store = new ModelStore({ connection, fetch: fake.fetch, agents: ['build'] });
    disposers.push(() => store.dispose());
    await store.load();
    expect(store.getState().agents.map((a) => a.name)).toEqual(['build']);
    expect(controls(store).agent.visible).toBe(false);
    store.setAgent('plan');
    expect(current(store)[0]).toBe('build');

    const other = new ModelStore({ connection, fetch: fakeOpencode().fetch, agents: ['missing'] });
    disposers.push(() => other.dispose());
    await other.load();
    expect(other.getState().agents.map((a) => a.name)).toEqual(['build']);
  });
});

describe('sessions', () => {
  const selection = { agent: 'build', model: OPUS, variant: 'high' };

  it('hands the new chat draft to its session, which the server then owns', async () => {
    const { store } = await setup();
    store.setModel(OPUS);
    store.setVariant('high');
    store.promote(SESSION_ID, selection);
    expect(store.getState()).toMatchObject({ sessionID: SESSION_ID, draft: undefined });
    expect(store.getState().saved[SESSION_ID]).toMatchObject({ agent: 'build', model: OPUS, variant: 'high' });
    store.setDurable(SESSION_ID, { agent: 'build', model: { ...OPUS, variant: 'high' } });
    expect(store.getState().saved[SESSION_ID]).toEqual({ choices: undefined });
    expect(current(store)).toEqual(['build', 'anthropic/claude-opus-5-5', 'high']);
  });

  it('keeps a session selection until the server confirms the committed one', async () => {
    const { store } = await setup();
    store.focus(SESSION_ID);
    store.setDurable(SESSION_ID, { agent: 'build', model: FLINT });
    store.setModel(OPUS);
    store.setVariant('high');
    const cancel = store.trackCommit(SESSION_ID, selection);
    store.setDurable(SESSION_ID, { agent: 'build', model: FLINT });
    expect(store.getState().saved[SESSION_ID]?.model).toEqual(OPUS);
    store.setDurable(SESSION_ID, { agent: 'build', model: { ...OPUS, variant: 'high' } });
    expect(store.getState().saved[SESSION_ID]?.model).toBeUndefined();
    expect(current(store)[2]).toBe('high');
    cancel();
  });

  it('keeps each chat effort to itself', async () => {
    const { store } = await setup();
    store.focus(SESSION_ID);
    store.setModel(OPUS);
    expect(store.getState().saved[SESSION_ID]?.variant).toBeNull();
    store.focus(null);
    store.setModel(OPUS);
    store.setVariant('low');
    store.focus(SESSION_ID);
    expect(current(store)[2]).toBe('default');
  });

  it('starts each new chat from a fresh draft', async () => {
    const { store } = await setup();
    store.setModel(SONNET);
    store.focus('ses_other');
    store.focus(null);
    expect(store.getState().draft).toBeUndefined();
    expect(current(store)).toEqual(['build', 'anthropic/claude-sonnet-5-5', 'default']);
  });

  it('restores the last chosen model and effort in a new panel and new chat', async () => {
    const first = await setup();
    first.store.focus(SESSION_ID);
    first.store.setModel(OPUS, { recent: true });
    first.store.setVariant('high');
    await vi.waitFor(async () => expect(await loadLastChoice(BASE)).toEqual({ model: OPUS, variant: 'high' }));
    first.store.focus(null);
    expect(current(first.store)).toEqual(['build', 'anthropic/claude-opus-5-5', 'high']);
    const second = await setup();
    expect(current(second.store)).toEqual(['build', 'anthropic/claude-opus-5-5', 'high']);
    expect(await loadLastChoice('http://127.0.0.1:1')).toBeUndefined();
  });

  it('uses the most recent available model when upgrading from older saved preferences', async () => {
    await savePreferences({ user: [], favorite: [], recent: [{ providerID: 'gone', modelID: 'missing' }, SONNET] });
    const { store } = await setup();
    expect(current(store)).toEqual(['build', 'anthropic/claude-sonnet-5-5', 'default']);
  });

  it('keeps an existing chat’s server model when a last choice exists', async () => {
    const { store } = await setup();
    store.setModel(OPUS);
    store.focus(SESSION_ID);
    store.setDurable(SESSION_ID, { agent: 'build', model: FLINT });
    expect(current(store)[1]).toBe('opencode/flint-40b-free');
  });

  it('persists session selections and forgets deleted sessions', async () => {
    const { fake, store } = await setup({}, { events: true });
    store.focus(SESSION_ID);
    store.setModel(OPUS);
    await vi.waitFor(async () => expect((await loadSavedSelections(BASE))[SESSION_ID]?.model).toEqual(OPUS));
    fake.emit('session.deleted', {});
    await vi.waitFor(() => expect(store.getState().saved[SESSION_ID]).toBeUndefined());
  });

  it('picks up saved selections when it loads', async () => {
    const first = await setup();
    first.store.focus(SESSION_ID);
    first.store.setModel(SONNET);
    await vi.waitFor(async () => expect((await loadSavedSelections(BASE))[SESSION_ID]).toBeDefined());
    const { store } = await setup({ overrides: { 'GET /api/provider': () => jsonResponse(PROVIDERS) } });
    store.focus(SESSION_ID);
    expect(current(store)[1]).toBe('anthropic/claude-sonnet-5-5');
  });
});
