import { describe, expect, it } from 'vitest';
import {
  compareProviders,
  defaultVisible,
  matchesSearch,
  modelLabels,
  parseAgents,
  parseCatalog,
  readDetails,
  parseConfiguredModel,
  providerName,
  resolveAgent,
} from '@/lib/opencode/models/catalog';
import { AGENTS, MODELS, PROVIDERS, modelInfo } from '@/tests/support/testkit';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-01T00:00:00Z');

describe('parseCatalog', () => {
  it('groups models under their providers and reads variants, inputs and the free flag', () => {
    const catalog = parseCatalog(PROVIDERS, MODELS);
    expect(catalog.providers.map((p) => [p.id, p.models.map((m) => m.modelID)])).toEqual([
      ['opencode', ['flint-40b-free']],
      ['anthropic', ['claude-opus-5-5', 'claude-sonnet-5-5']],
    ]);
    const opus = catalog.providers[1]!.models[0]!;
    expect(opus).toMatchObject({ variants: ['low', 'medium', 'high'], inputs: ['text', 'image'], tools: true, free: false });
    expect(catalog.providers[0]!.models[0]!.free).toBe(true);
  });

  it('drops deprecated models, models of unlisted providers and malformed rows, and strips "(latest)"', () => {
    const catalog = parseCatalog(
      { data: [{ id: 'openai', name: 'OpenAI' }, 'junk'] },
      {
        data: [
          { ...modelInfo('openai', 'gpt-old', 'GPT Old'), status: 'deprecated' },
          modelInfo('openai', 'gpt-6', 'GPT 6 (latest)'),
          modelInfo('ghost', 'g-1', 'Ghost'),
          { providerID: 'openai' },
        ],
      },
    );
    expect(catalog.providers[0]!.models).toEqual([expect.objectContaining({ modelID: 'gpt-6', name: 'GPT 6', latest: true })]);
  });

  it('treats a zero release time as unknown', () => {
    const catalog = parseCatalog(PROVIDERS, { data: [modelInfo('opencode', 'x', 'X', { released: 0 })] });
    expect(catalog.providers[0]!.models[0]!.released).toBeNaN();
  });
});

describe('default visibility', () => {
  it('shows every model, old or new, so a model that arrives later is on', () => {
    const catalog = parseCatalog(
      { data: [{ id: 'anthropic', name: 'Anthropic' }, { id: 'opencode', name: 'OpenCode' }] },
      {
        data: [
          modelInfo('anthropic', 'old', 'Old', { released: NOW - 900 * DAY }),
          modelInfo('anthropic', 'undated', 'Undated', { released: 0 }),
          modelInfo('opencode', 'pickle', 'Big Pickle', { free: true, released: NOW - 400 * DAY }),
        ],
      },
    );
    expect([...defaultVisible(catalog)].sort()).toEqual(['anthropic:old', 'anthropic:undated', 'opencode:pickle']);
    expect(defaultVisible(null).size).toBe(0);
  });
});

describe('labels', () => {
  it('names no provider for OpenCode models and the provider for others', () => {
    const catalog = parseCatalog(PROVIDERS, MODELS);
    const labels = modelLabels(catalog);
    expect(labels.get('opencode:flint-40b-free')).toEqual({ provider: undefined, model: 'Flint 40B Free' });
    expect(labels.get('anthropic:claude-opus-5-5')).toEqual({ provider: 'Anthropic', model: 'Claude Opus 5.5' });
  });

  it('tells apart same-named models by the differing part of their IDs, and same-named providers by ID', () => {
    const catalog = parseCatalog(
      { data: [{ id: 'a', name: 'Cloud' }, { id: 'b', name: 'Cloud' }] },
      {
        data: [
          modelInfo('a', 'gemini-4-argon', 'Gemini'),
          modelInfo('a', 'gemini-4-argon-eap', 'Gemini'),
          modelInfo('b', 'm', 'Shared'),
          modelInfo('a', 'm', 'Shared'),
        ],
      },
    );
    const labels = modelLabels(catalog);
    expect(labels.get('a:gemini-4-argon')?.model).toBe('Gemini');
    expect(labels.get('a:gemini-4-argon-eap')?.model).toBe('Gemini (eap)');
    expect(labels.get('b:m')?.provider).toBe('b');
  });

  it('marks a provider routed through OpenCode when the same provider is connected directly', () => {
    const catalog = parseCatalog(
      {
        data: [
          { id: 'console-anthropic', name: 'Anthropic', integrationID: 'opencode', canonical: 'anthropic' },
          { id: 'anthropic', name: 'Anthropic' },
        ],
      },
      { data: [] },
    );
    expect(providerName(catalog, 'console-anthropic')).toBe('OpenCode / Anthropic');
  });
});

describe('search and order', () => {
  it('matches loosely, ignoring punctuation and spaces', () => {
    expect(matchesSearch('gpt5', ['GPT-5 Codex'])).toBe(true);
    expect(matchesSearch('opus 5', ['claude-opus-5-5'])).toBe(true);
    expect(matchesSearch('gemini', ['Claude'])).toBe(false);
    expect(matchesSearch('  ', ['anything'])).toBe(true);
  });

  it('lists popular providers first, then the rest by name', () => {
    const p = (id: string, name = id) => ({ id, name, models: [] });
    const sorted = [p('zeta'), p('anthropic'), p('alpha'), p('opencode')].sort(compareProviders);
    expect(sorted.map((x) => x.id)).toEqual(['opencode', 'anthropic', 'alpha', 'zeta']);
  });
});

describe('agents and config', () => {
  it('offers primary, visible agents only, with any model they pin', () => {
    const agents = parseAgents({
      data: [
        ...AGENTS.data,
        { id: 'secret', mode: 'primary', hidden: true },
        { id: 'docs', mode: 'all', hidden: false, model: { id: 'opus', providerID: 'anthropic', variant: 'high' } },
      ],
    });
    expect(agents).toEqual([
      { name: 'build', model: undefined, variant: undefined },
      { name: 'plan', model: undefined, variant: undefined },
      { name: 'docs', model: { providerID: 'anthropic', modelID: 'opus' }, variant: 'high' },
    ]);
  });

  it('falls back to build, then the first agent', () => {
    const agents = parseAgents(AGENTS);
    expect(resolveAgent(agents, 'plan')?.name).toBe('plan');
    expect(resolveAgent(agents, 'missing')?.name).toBe('build');
    expect(resolveAgent([{ name: 'only' }], undefined)?.name).toBe('only');
  });

  it('reads the highest-priority configured model, as a string or an object', () => {
    expect(
      parseConfiguredModel([
        { type: 'document', info: { model: 'openai/gpt-6' } },
        { type: 'document', info: { model: 'anthropic/claude/opus' } },
        { type: 'discovery', info: {} },
      ]),
    ).toEqual({ providerID: 'anthropic', modelID: 'claude/opus' });
    expect(
      parseConfiguredModel([{ type: 'document', info: { model: { providerID: 'a', model: 'm', variant: 'high' } } }]),
    ).toEqual({ providerID: 'a', modelID: 'm', variant: 'high' });
    expect(parseConfiguredModel([])).toBeUndefined();
  });
});

describe('model details', () => {
  it('reads limits, outputs, status and price tiers from the model list', () => {
    const catalog = parseCatalog(
      [{ id: 'p', name: 'P' }],
      [
        {
          providerID: 'p',
          id: 'm',
          name: 'M',
          status: 'beta',
          capabilities: { tools: true, input: ['text'], output: ['text', 'image'], temperature: true },
          limit: { context: 100, output: 50, input: 80 },
          cost: [
            { tier: { type: 'context', size: 200_000 }, input: 2, output: 6, cache: { read: 0.2, write: 0.4 } },
            { input: 1, output: 3, cache: { read: 0.1, write: 0.2 } },
          ],
        },
      ],
    );
    const details = catalog.providers[0]!.models[0]!.details!;
    expect(details).toMatchObject({ status: 'beta', outputs: ['text', 'image'], maxOutput: 50, maxInput: 80, temperature: true });
    expect(details.prices.map((price) => [price.input, price.contextOver])).toEqual([[1, undefined], [2, 200_000]]);
  });

  it('survives a trip through the cache and drops malformed values', () => {
    expect(readDetails('nope')).toBeUndefined();
    expect(readDetails({ status: 'weird', outputs: ['text', 3], prices: [null, { input: 1, contextOver: 5 }] })).toEqual({
      type: undefined,
      status: 'active',
      outputs: ['text'],
      maxOutput: 0,
      maxInput: 0,
      temperature: undefined,
      prices: [{ input: 1, output: 0, cacheRead: 0, cacheWrite: 0, contextOver: 5 }],
    });
  });
});
