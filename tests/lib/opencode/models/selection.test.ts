import { describe, expect, it } from 'vitest';
import { parseAgents, parseCatalog, type AgentOption } from '@/lib/opencode/models/catalog';
import { EMPTY_PREFERENCES, pushRecent } from '@/lib/opencode/models/preferences';
import {
  fromDurable,
  loadSavedSelections,
  resolveSelection,
  sameSelection,
  saveSelections,
  sendSelection,
  type ResolveInput,
} from '@/lib/opencode/models/selection';
import { AGENTS, BASE, MODELS, PROVIDERS } from '@/tests/support/testkit';

const catalog = parseCatalog(PROVIDERS, MODELS);
const FLINT = { providerID: 'opencode', modelID: 'flint-40b-free' };
const OPUS = { providerID: 'anthropic', modelID: 'claude-opus-5-5' };
const SONNET = { providerID: 'anthropic', modelID: 'claude-sonnet-5-5' };

const input = (patch: Partial<ResolveInput> = {}): ResolveInput => ({
  catalog,
  agents: parseAgents(AGENTS),
  configured: undefined,
  prefs: EMPTY_PREFERENCES,
  scope: undefined,
  durable: undefined,
  ...patch,
});

const modelOf = (patch: Partial<ResolveInput>) => resolveSelection(input(patch)).key;

describe('model resolution order', () => {
  it('falls back to the catalog first model', () => {
    expect(modelOf({})).toEqual(FLINT);
  });

  it('prefers a recent model, then the configured one, then the agent own model', () => {
    const prefs = pushRecent(EMPTY_PREFERENCES, SONNET);
    expect(modelOf({ prefs })).toEqual(SONNET);
    expect(modelOf({ prefs, configured: OPUS })).toEqual(OPUS);
    const agents: AgentOption[] = [{ name: 'build', model: SONNET }];
    expect(modelOf({ prefs, configured: OPUS, agents })).toEqual(SONNET);
  });

  it('skips fallbacks the catalog does not offer', () => {
    expect(modelOf({ configured: { providerID: 'gone', modelID: 'x' } })).toEqual(FLINT);
  });

  it('uses the session model when it belongs to the current agent', () => {
    expect(modelOf({ durable: { agent: 'build', model: OPUS } })).toEqual(OPUS);
    // The user picked another agent locally: the session's model belongs to its old agent.
    expect(modelOf({ scope: { agent: 'build' }, durable: { agent: 'plan', model: OPUS } })).toEqual(FLINT);
  });

  it('lets the local choice win, and keeps it even when the catalog no longer offers it', () => {
    expect(modelOf({ scope: { model: SONNET }, durable: { agent: 'build', model: OPUS } })).toEqual(SONNET);
    const gone = { providerID: 'gone', modelID: 'x' };
    const resolved = resolveSelection(input({ scope: { model: gone } }));
    expect(resolved.key).toEqual(gone);
    expect(resolved.model).toBeUndefined();
    expect(sendSelection(resolved)).toBeUndefined();
  });
});

describe('variant resolution', () => {
  it('uses the chosen variant, null meaning default even over a configured one', () => {
    expect(resolveSelection(input({ scope: { model: OPUS, variant: 'high' } })).variant).toBe('high');
    const configured = { ...OPUS, variant: 'medium' };
    expect(resolveSelection(input({ configured, scope: { model: OPUS, variant: null } })).variant).toBeUndefined();
    expect(resolveSelection(input({ configured, scope: { model: OPUS } })).variant).toBe('medium');
  });

  it('takes the session variant, or default when it records none', () => {
    expect(resolveSelection(input({ durable: { agent: 'build', model: { ...OPUS, variant: 'low' } } })).variant).toBe('low');
    const configured = { ...OPUS, variant: 'high' };
    const resolved = resolveSelection(input({ configured, durable: { agent: 'build', model: OPUS } }));
    expect(resolved.selected).toBeNull();
    expect(resolved.variant).toBeUndefined();
  });

  it('applies a configured variant only to its model, the agent before the config file', () => {
    const agents: AgentOption[] = [{ name: 'build', model: OPUS, variant: 'low' }];
    expect(resolveSelection(input({ agents })).variant).toBe('low');
    const configured = { ...OPUS, variant: 'high' };
    expect(resolveSelection(input({ configured })).variant).toBe('high');
    expect(resolveSelection(input({ configured, scope: { model: SONNET } })).variant).toBeUndefined();
  });
});

describe('agents and comparison', () => {
  it('resolves the chosen agent, else the session agent, else build', () => {
    expect(resolveSelection(input({ scope: { agent: 'plan' } })).agent?.name).toBe('plan');
    expect(resolveSelection(input({ durable: { agent: 'plan' } })).agent?.name).toBe('plan');
    expect(resolveSelection(input()).agent?.name).toBe('build');
  });

  it('treats "default" and no variant as the same selection', () => {
    expect(sameSelection({ agent: 'build', model: OPUS, variant: null }, fromDurable({ agent: 'build', model: OPUS }))).toBe(true);
    expect(sameSelection({ agent: 'build', model: OPUS, variant: 'high' }, fromDurable({ agent: 'build', model: OPUS }))).toBe(false);
  });

  it('persists selections per server', async () => {
    await saveSelections(BASE, { s1: { agent: 'plan', model: OPUS, variant: null, choices: { build: { model: FLINT } } } });
    expect(await loadSavedSelections(BASE)).toEqual({
      s1: { agent: 'plan', model: OPUS, variant: null, choices: { build: { model: FLINT, variant: undefined } } },
    });
    expect(await loadSavedSelections('http://127.0.0.1:1')).toEqual({});
  });
});
