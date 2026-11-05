import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelCard } from '@/components/settings/model-card';
import type { CatalogModel, CatalogProvider } from '@/lib/opencode/models/catalog';

const base: CatalogModel = {
  providerID: 'anthropic',
  modelID: 'claude-opus-5-5',
  name: 'Claude Opus 5.5',
  latest: true,
  family: 'claude-opus',
  released: Date.parse('2026-05-01T00:00:00Z'),
  free: false,
  variants: ['low', 'high'],
  context: 1_000_000,
  inputs: ['text', 'image'],
  tools: true,
  details: {
    status: 'beta',
    outputs: ['text'],
    maxOutput: 64_000,
    maxInput: 0,
    temperature: false,
    prices: [
      { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
      { input: 10, output: 37.5, cacheRead: 1, cacheWrite: 12.5, contextOver: 200_000 },
    ],
  },
};
const provider: CatalogProvider = { id: 'anthropic', name: 'Anthropic', models: [base] };

describe('ModelCard', () => {
  it('lays out identity, capabilities, limits, pricing tiers and release date', () => {
    render(<ModelCard model={base} provider={provider} />);
    expect(screen.getByRole('heading', { name: 'Claude Opus 5.5' })).toBeInTheDocument();
    expect(screen.getByText('claude-opus-5-5')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
    expect(screen.getByText('1M tokens')).toBeInTheDocument();
    expect(screen.getByText('64K tokens')).toBeInTheDocument();
    expect(screen.queryByText('Max input')).not.toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('Over 200K context')).toBeInTheDocument();
    expect(screen.getByText('$37.50')).toBeInTheDocument();
    expect(screen.getByText('Released')).toBeInTheDocument();
  });

  it('shows Free instead of prices, and omits what the catalog does not give', () => {
    const free: CatalogModel = { ...base, free: true, details: undefined, context: 0, released: NaN, variants: [], inputs: [] };
    render(<ModelCard model={free} provider={undefined} />);
    expect(screen.getByText('Free', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.queryByText('Limits')).not.toBeInTheDocument();
    expect(screen.queryByText('Release')).not.toBeInTheDocument();
    expect(screen.queryByText('Reasoning effort')).not.toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
  });
});
