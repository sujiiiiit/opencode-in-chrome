import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ChatScreen } from '@/components/chat/chat-screen';
import { BROWSER_ENABLED_KEY } from '@/lib/browser/settings';
import { modelShortcut } from '@/components/chat/model/use-models';
import { ModelControls } from '@/components/chat/model/model-controls';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { buildControls } from '@/lib/opencode/models/controls';
import { INITIAL_MODEL_STATE } from '@/lib/opencode/models/model-store';
import { PREFERENCES_KEY } from '@/lib/opencode/models/preferences';
import type { Connection } from '@/lib/opencode/connection';
import { fakeOpencode, type FakeOpencode } from '@/tests/support/queue-server';
import { NO_MODEL_MESSAGE } from '@/lib/opencode/client';
import { BASE, SESSION_ID, TOKEN, WORKSPACE_WIN, jsonResponse } from '@/tests/support/testkit';

const connection: Connection = {
  baseUrl: BASE,
  token: TOKEN,
  expiresAt: Date.now() + 20 * 86_400_000,
  serverVersion: '2.2.5',
  pairedAt: 1,
};

// React reports invalid DOM nesting as an error that "will cause a hydration error"; none may occur.
let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  await fakeBrowser.storage.local.set({ [BROWSER_ENABLED_KEY]: false });
  consoleError = vi.spyOn(console, 'error');
});
afterEach(() => {
  const nesting = consoleError.mock.calls.filter((args: unknown[]) => /hydration|cannot be a descendant|cannot contain a nested/i.test(String(args[0])));
  expect(nesting).toEqual([]);
});

const box = () => screen.getByRole('textbox', { name: /message/i });
const chip = () => screen.getByRole('button', { name: /^(model:|choose model)/i });
const picker = () => screen.getByRole('menu', { name: /choose model/i });
const options = () => within(picker()).getAllByRole('button').filter((button) => button.hasAttribute('aria-current') || /Claude|Flint/.test(button.textContent ?? ''));
const createBody = (fake: FakeOpencode) =>
  JSON.parse(fake.fetch.calls.find((c) => c.method === 'POST' && c.url.pathname === '/api/session')!.init.body as string);

async function mount(fake: FakeOpencode = fakeOpencode()) {
  vi.stubGlobal('fetch', fake.fetch);
  render(<ChatScreen connection={connection} onUnauthorized={vi.fn()} />);
  const user = userEvent.setup();
  await waitFor(() => expect(chip()).toHaveAccessibleName('Model: Flint 40B Free'));
  return { fake, user };
}

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(chip());
  return picker();
}

describe('composer model controls', () => {
  it('shows model and effort skeletons while the catalog is loading', () => {
    const controls = buildControls(INITIAL_MODEL_STATE);
    const { container, rerender } = render(<DropdownMenu><ModelControls controls={controls} pending /></DropdownMenu>);
    expect(screen.getByRole('status', { name: /loading model and effort/i })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(1);
    expect(screen.queryByText(/loading models/i)).not.toBeInTheDocument();
    rerender(<DropdownMenu><ModelControls controls={{ ...controls, loading: false }} /></DropdownMenu>);
    expect(screen.queryByRole('status', { name: /loading model and effort/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose model/i })).toBeInTheDocument();
  });

  it('shows the default model, no agent chip (build mode only), and no effort for a model without variants', async () => {
    await mount();
    expect(screen.queryByRole('button', { name: /^agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^effort/i })).not.toBeInTheDocument();
  });

  it('chooses a model in the picker, then an effort, and the first send uses both', async () => {
    const { fake, user } = await mount();
    await openPicker(user);
    await user.type(within(picker()).getByRole('textbox', { name: 'Search models' }), 'opus');
    expect(options().map((o) => o.textContent)).toEqual([expect.stringContaining('Claude Opus 5.5')]);
    await user.click(options()[0]!);
    const slider = within(picker()).getByRole('slider', { name: 'Select effort' });
    expect(slider).toHaveAttribute('aria-valuetext', 'default');
    fireEvent.change(slider, { target: { value: '3' } });
    expect(slider).toHaveAttribute('aria-valuetext', 'high');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu', { name: /choose model/i })).not.toBeInTheDocument());
    expect(chip()).toHaveAccessibleName('Model: Claude Opus 5.5, effort: high');
    expect(chip()).toHaveTextContent(/Claude Opus 5.5.*·.*high/);

    await user.type(box(), 'hello{Enter}');
    await waitFor(() => expect(fake.prompts).toHaveLength(1));
    expect(createBody(fake)).toMatchObject({
      agent: 'build',
      model: { providerID: 'anthropic', id: 'claude-opus-5-5', variant: 'high' },
    });
  });

  it('switches the model of an existing chat before the next prompt', async () => {
    const { fake, user } = await mount();
    await user.type(box(), 'first{Enter}');
    await waitFor(() => expect(fake.prompts).toHaveLength(1));
    await openPicker(user);
    await user.click(within(picker()).getByRole('button', { name: 'Anthropic' }));
    await user.click(options().find((o) => o.textContent?.includes('Claude Sonnet 5.5'))!);
    fireEvent.change(within(picker()).getByRole('slider', { name: 'Select effort' }), { target: { value: '1' } });
    await user.keyboard('{Escape}');
    await user.type(box(), 'second{Enter}');
    await waitFor(() => expect(fake.prompts).toHaveLength(2));
    expect(fake.switches).toEqual(['model:anthropic/claude-sonnet-5-5/low']);
    expect(fake.log.slice(-2)).toEqual(['model:anthropic/claude-sonnet-5-5/low', 'prompt:steer']);
  });

  it('runs in build mode only: no agent chip, and sends use build', async () => {
    const { fake, user } = await mount();
    expect(screen.queryByRole('button', { name: /^agent/i })).not.toBeInTheDocument();
    await user.type(box(), 'go{Enter}');
    await waitFor(() => expect(fake.prompts).toHaveLength(1));
    expect(createBody(fake)).toMatchObject({ agent: 'build' });
  });
});

describe('no model to send with', () => {
  it('keeps the draft and says why when the server offers no model', async () => {
    const fake = fakeOpencode({ overrides: { 'GET /api/model': () => jsonResponse({ data: [] }) } });
    vi.stubGlobal('fetch', fake.fetch);
    render(<ChatScreen connection={connection} onUnauthorized={vi.fn()} />);
    const user = userEvent.setup();
    await waitFor(() => expect(chip()).toHaveAccessibleName('Choose model'));
    expect(chip()).toHaveTextContent('No models');
    await user.type(box(), 'hello{Enter}');
    expect(await screen.findByText(NO_MODEL_MESSAGE)).toBeInTheDocument();
    expect(box()).toHaveTextContent('hello');
    expect(fake.prompts).toEqual([]);
  });
});

describe('model picker', () => {
  it('closes after selecting a model without efforts and stays open when efforts exist', async () => {
    const { user } = await mount();
    await openPicker(user);
    await user.click(within(picker()).getByRole('button', { name: 'Anthropic' }));
    await user.click(within(picker()).getByRole('button', { name: 'Claude Opus 5.5' }));
    expect(within(picker()).getByRole('slider', { name: 'Select effort' })).toBeInTheDocument();
    await user.click(within(picker()).getByRole('button', { name: 'OpenCode' }));
    await user.click(within(picker()).getByRole('button', { name: 'Flint 40B Free' }));
    await waitFor(() => expect(screen.queryByRole('menu', { name: /choose model/i })).not.toBeInTheDocument());
    expect(chip()).toHaveAccessibleName('Model: Flint 40B Free');
  });

  it('shows centered empty states for recent, favorites, and search', async () => {
    const { user } = await mount();
    await openPicker(user);
    await user.click(within(picker()).getByRole('button', { name: 'Recent' }));
    expect(within(picker()).getByText('No recent models').closest('[data-slot="empty-state"]')).toBeInTheDocument();
    await user.click(within(picker()).getByRole('button', { name: 'Favorites' }));
    expect(within(picker()).getByText('No favorite models').closest('[data-slot="empty-state"]')).toBeInTheDocument();
    await user.type(within(picker()).getByRole('textbox', { name: 'Search models' }), 'no-such-model');
    expect(within(picker()).getByText('No matching models').closest('[data-slot="empty-state"]')).toBeInTheDocument();
  });

  it('toggles from its trigger and closes with Escape', async () => {
    const { user } = await mount();
    await user.click(chip());
    expect(picker()).toBeInTheDocument();
    expect(chip()).toHaveAttribute('aria-expanded', 'true');
    await user.click(chip());
    await waitFor(() => expect(screen.queryByRole('menu', { name: /choose model/i })).not.toBeInTheDocument());
    await user.click(chip());
    expect(picker()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu', { name: /choose model/i })).not.toBeInTheDocument());
    await user.click(chip());
    expect(picker()).toBeInTheDocument();
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('menu', { name: /choose model/i })).not.toBeInTheDocument());
  });

  it('hides disabled models even when they are favorites or recent', async () => {
    const key = { providerID: 'anthropic', modelID: 'claude-opus-5-5' };
    await fakeBrowser.storage.local.set({ [PREFERENCES_KEY]: { user: [{ ...key, visibility: 'hide' }], favorite: [key], recent: [key] } });
    vi.stubGlobal('fetch', fakeOpencode().fetch);
    render(<ChatScreen connection={connection} onUnauthorized={vi.fn()} />);
    const user = userEvent.setup();
    await waitFor(() => expect(chip()).toHaveAccessibleName(/^Model:/));
    await openPicker(user);
    await user.click(within(picker()).getByRole('button', { name: 'Favorites' }));
    expect(within(picker()).queryByRole('button', { name: 'Claude Opus 5.5' })).not.toBeInTheDocument();
    await user.type(within(picker()).getByRole('textbox', { name: 'Search models' }), 'opus');
    expect(within(picker()).queryByRole('button', { name: 'Claude Opus 5.5' })).not.toBeInTheDocument();
  });

  it('switches providers and chooses an enabled model', async () => {
    const { user } = await mount();
    await openPicker(user);
    await user.click(within(picker()).getByRole('button', { name: 'Anthropic' }));
    expect(within(picker()).getByRole('button', { name: 'Claude Opus 5.5' })).toBeInTheDocument();
    await user.click(within(picker()).getByRole('button', { name: 'Claude Opus 5.5' }));
    await waitFor(() => expect(chip()).toHaveAccessibleName('Model: Claude Opus 5.5, effort: default'));
  });

  it('adds favorites and shows recent selections', async () => {
    const { user } = await mount();
    await openPicker(user);
    await user.click(within(picker()).getByRole('button', { name: 'Anthropic' }));
    await user.click(within(picker()).getByRole('button', { name: 'Add Claude Sonnet 5.5 to favorites' }));
    await user.click(within(picker()).getByRole('button', { name: 'Favorites' }));
    expect(within(picker()).getByRole('button', { name: 'Claude Sonnet 5.5' })).toBeInTheDocument();
    await user.click(within(picker()).getByRole('button', { name: 'Claude Sonnet 5.5' }));
    await user.click(within(picker()).getByRole('button', { name: 'Recent' }));
    expect(within(picker()).getByRole('button', { name: 'Claude Sonnet 5.5' })).toBeInTheDocument();
  });

  it('searches across providers and updates effort options for the selected model', async () => {
    const { user } = await mount();
    await openPicker(user);
    await user.type(within(picker()).getByRole('textbox', { name: 'Search models' }), 'opus');
    expect(within(picker()).getByRole('button', { name: 'Claude Opus 5.5' })).toBeInTheDocument();
    expect(within(picker()).queryByRole('slider')).not.toBeInTheDocument();
    expect(within(picker()).queryByText('Select effort')).not.toBeInTheDocument();
    await user.click(within(picker()).getByRole('button', { name: 'Claude Opus 5.5' }));
    expect(within(picker()).getByRole('slider', { name: 'Select effort' })).toHaveAttribute('max', '3');
    await user.click(within(picker()).getByRole('button', { name: 'Anthropic' }));
    await user.click(within(picker()).getByRole('button', { name: 'Claude Sonnet 5.5' }));
    expect(within(picker()).getByRole('slider', { name: 'Select effort' })).toHaveAttribute('max', '2');
  });
});

describe('model shortcuts', () => {
  it("opens the picker with Ctrl+' and cycles effort with Ctrl+Shift+D; Ctrl+. is left alone", async () => {
    const { user } = await mount();
    fireEvent.keyDown(window, { code: 'Quote', key: "'", ctrlKey: true });
    expect(await screen.findByRole('menu', { name: /choose model/i })).toBeInTheDocument();
    await user.click(within(picker()).getByRole('button', { name: 'Anthropic' }));
    await user.click(options().find((o) => o.textContent?.includes('Claude Opus 5.5'))!);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu', { name: /choose model/i })).not.toBeInTheDocument());

    fireEvent.keyDown(window, { code: 'KeyD', key: 'D', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(chip()).toHaveAccessibleName('Model: Claude Opus 5.5, effort: low'));
    // Agent switching is hidden: the key reaches the browser untouched.
    expect(fireEvent.keyDown(window, { code: 'Period', key: '.', ctrlKey: true })).toBe(true);
    expect(screen.queryByRole('button', { name: /^agent/i })).not.toBeInTheDocument();
  });

  it('maps keys by physical position and ignores Alt and repeats', () => {
    const key = (init: KeyboardEventInit) => modelShortcut(new KeyboardEvent('keydown', init));
    expect(key({ code: 'Quote', metaKey: true })).toBe('picker');
    expect(key({ code: 'Quote', ctrlKey: true, altKey: true })).toBeNull();
    expect(key({ code: 'KeyD', ctrlKey: true })).toBeNull();
    expect(key({ code: 'Period', ctrlKey: true, repeat: true })).toBeNull();
  });
});

describe('restoring a chat', () => {
  it('shows the model the server has for a reopened chat', async () => {
    const fake = fakeOpencode({
      sessions: [
        {
          id: SESSION_ID,
          time: { created: 1, updated: 1 },
          location: { directory: WORKSPACE_WIN },
          agent: 'build',
          model: { providerID: 'anthropic', id: 'claude-opus-5-5', variant: 'low' },
        },
      ],
    });
    const { browser } = await import('wxt/browser');
    await browser.storage.local.set({ 'opencode.activeChat': { baseUrl: BASE, sessionID: SESSION_ID } });
    vi.stubGlobal('fetch', fake.fetch);
    render(<ChatScreen connection={connection} onUnauthorized={vi.fn()} />);
    await waitFor(() => expect(chip()).toHaveAccessibleName('Model: Claude Opus 5.5, effort: low'));
  });

  it('moves a chat started in another agent to build on its next send', async () => {
    const fake = fakeOpencode({
      sessions: [
        {
          id: SESSION_ID,
          time: { created: 1, updated: 1 },
          location: { directory: WORKSPACE_WIN },
          agent: 'plan',
          model: { providerID: 'anthropic', id: 'claude-opus-5-5' },
        },
      ],
    });
    const { browser } = await import('wxt/browser');
    await browser.storage.local.set({ 'opencode.activeChat': { baseUrl: BASE, sessionID: SESSION_ID } });
    vi.stubGlobal('fetch', fake.fetch);
    render(<ChatScreen connection={connection} onUnauthorized={vi.fn()} />);
    const user = userEvent.setup();
    await waitFor(() => expect(chip()).toHaveAccessibleName(/^Model:/));
    await user.type(box(), 'next{Enter}');
    await waitFor(() => expect(fake.prompts).toHaveLength(1));
    expect(fake.switches[0]).toBe('agent:build');
  });
});
