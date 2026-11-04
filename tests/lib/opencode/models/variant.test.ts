import { describe, expect, it } from 'vitest';
import { configuredVariant, cycleVariant, resolveVariant } from '@/lib/opencode/models/variant';

const variants = ['low', 'medium', 'high'];

describe('resolveVariant', () => {
  it('uses the chosen variant, then the configured one', () => {
    expect(resolveVariant({ variants, selected: 'low', configured: 'medium' })).toBe('low');
    expect(resolveVariant({ variants, selected: undefined, configured: 'medium' })).toBe('medium');
  });

  it('treats null as an explicit default that beats the configured variant', () => {
    expect(resolveVariant({ variants, selected: null, configured: 'medium' })).toBeUndefined();
  });

  it('ignores "default" and variants the model does not have', () => {
    expect(resolveVariant({ variants, selected: 'default', configured: 'medium' })).toBeUndefined();
    expect(resolveVariant({ variants, selected: 'max', configured: undefined })).toBeUndefined();
    expect(resolveVariant({ variants: [], selected: 'low', configured: undefined })).toBeUndefined();
  });
});

describe('cycleVariant', () => {
  it('goes default → first → … → last → default', () => {
    const step = (selected: string | null) => cycleVariant({ variants, selected, configured: undefined });
    expect(step(null)).toBe('low');
    expect(step('low')).toBe('medium');
    expect(step('high')).toBeUndefined();
  });
});

describe('configuredVariant', () => {
  const model = { providerID: 'anthropic', modelID: 'opus', variants };

  it('applies only to the model it was configured with', () => {
    const config = { model: { providerID: 'anthropic', modelID: 'opus' }, variant: 'high' };
    expect(configuredVariant({ config, model })).toBe('high');
    expect(configuredVariant({ config, model: { ...model, modelID: 'sonnet' } })).toBeUndefined();
    expect(configuredVariant({ config: { variant: 'high' }, model })).toBeUndefined();
    expect(configuredVariant({ config, model: { ...model, variants: [] } })).toBeUndefined();
  });
});
