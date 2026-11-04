import { describe, expect, it } from 'vitest';
import { logoFor } from '@/lib/opencode/models/logo';

const available = new Set(['kilo', 'openai', 'anthropic', 'opencode', 'synthetic']);

describe('logoFor', () => {
  it('uses the provider itself, so a gateway shows its own logo', () => {
    expect(logoFor({ id: 'kilo' }, available)).toBe('kilo');
  });

  it('prefers the canonical provider', () => {
    expect(logoFor({ id: 'opencode-zen-openai', canonical: 'openai' }, available)).toBe('openai');
  });

  it('drops the -token-plan suffix and the console- prefix', () => {
    expect(logoFor({ id: 'x', canonical: 'anthropic-token-plan' }, available)).toBe('anthropic');
    expect(logoFor({ id: 'console-openai' }, available)).toBe('openai');
  });

  it('never picks the synthetic placeholder, and returns undefined without a match', () => {
    expect(logoFor({ id: 'synthetic' }, available)).toBeUndefined();
    expect(logoFor({ id: 'nowhere' }, available)).toBeUndefined();
  });
});
