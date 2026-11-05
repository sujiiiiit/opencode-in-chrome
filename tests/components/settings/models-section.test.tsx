import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelsSection } from '@/components/settings/models-section';
import type { Connection } from '@/lib/opencode/connection';
import { parseCatalog } from '@/lib/opencode/models/catalog';
import { ModelStore } from '@/lib/opencode/models/model-store';
import { MODELS, PROVIDERS } from '@/tests/support/testkit';

let setVisibility: ReturnType<typeof vi.spyOn>;

const connection: Connection = { baseUrl: 'http://localhost:4096', token: '1.x', expiresAt: 1, serverVersion: '', pairedAt: 1 };

describe('ModelsSection', () => {
  beforeEach(() => {
    setVisibility = vi.spyOn(ModelStore.prototype, 'setVisibility').mockImplementation(() => undefined);
    // The store's real loading talks to a server; these tests hand it a ready catalog instead.
    vi.spyOn(ModelStore.prototype, 'load').mockImplementation(function (this: ModelStore) {
      (this as unknown as { set: (state: object) => void }).set({ phase: 'ready', catalog: parseCatalog(PROVIDERS, MODELS) });
      return Promise.resolve();
    });
  });

  it('lists providers collapsed, opens one on click, and switches a model', async () => {
    const user = userEvent.setup();
    render(<ModelsSection connection={connection} />);
    expect(screen.queryByText('Claude Opus 5.5')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /anthropic, \d+ models/i }));
    const row = (await screen.findByText('Claude Opus 5.5')).closest('label')!;
    await user.click(row.querySelector('[role="switch"]')!);
    expect(setVisibility).toHaveBeenCalledTimes(1);
    expect(setVisibility.mock.calls[0]![0]).toHaveLength(1);
  });

  it('opens every match while searching and says when nothing matches', async () => {
    const user = userEvent.setup();
    render(<ModelsSection connection={connection} />);
    const box = await screen.findByRole('searchbox', { name: /search all models/i });
    await user.type(box, 'sonnet');
    expect(await screen.findByText(/sonnet/i)).toBeInTheDocument();
    expect(screen.queryByText('Claude Opus 5.5')).not.toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'zzzz');
    expect(await screen.findByText(/no models match/i)).toBeInTheDocument();
  });

  it('switches a whole provider through its master switch', async () => {
    const user = userEvent.setup();
    render(<ModelsSection connection={connection} />);
    await user.click(await screen.findByRole('switch', { name: /show all anthropic models/i }));
    expect(setVisibility.mock.calls[0]![0].length).toBeGreaterThan(1);
  });

  it('shows skeleton rows with the search box while models load', () => {
    render(<ModelsSection connection={connection} preview="loading" />);
    expect(screen.getByRole('status', { name: /loading models/i })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search all models/i })).toBeEnabled();
  });

  it('says so when no provider has any models', () => {
    render(<ModelsSection connection={connection} preview="empty" />);
    expect(screen.getByText('No models yet')).toBeInTheDocument();
  });

  it('clears the search from the no-match state', async () => {
    const user = userEvent.setup();
    render(<ModelsSection connection={connection} />);
    const box = await screen.findByRole('searchbox', { name: /search all models/i });
    await user.type(box, 'zzzz');
    await user.click(await screen.findByRole('button', { name: /clear search and filter/i }));
    expect(box).toHaveValue('');
    expect(await screen.findByRole('button', { name: /anthropic, \d+ models/i })).toBeInTheDocument();
  });

  it('lists only the models that are switched on while "Enabled models" is pressed', async () => {
    const user = userEvent.setup();
    render(<ModelsSection connection={connection} />);
    const toggle = await screen.findByRole('button', { name: 'Enabled models' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // Every model is on by default, so the providers all stay, and the label does not change.
    expect(await screen.findByRole('button', { name: /anthropic, \d+ models/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enabled models' })).toBe(toggle);
  });
});
