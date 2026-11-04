import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatScreen } from '@/components/chat/chat-screen';
import { modelShortcut } from '@/components/chat/model/use-models';
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
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error');
});
afterEach(() => {
  const nesting = consoleError.mock.calls.filter((args: unknown[]) => /hydration|cannot be a descendant|cannot contain a nested/i.test(String(args[0])));
  expect(nesting).toEqual([]);
});

const box = () => screen.getByRole('textbox', { name: /message/i });
const chip = () => screen.getByRole('button', { name: /^(model:|choose model)/i });
const picker = () => screen.getByRole('dialog');
const options = () => within(picker()).getAllByRole('option');
/** A picker group's title: Base UI names the group by its (hidden) heading. */
const groupTitles = () =>
  within(picker())
    .getAllByRole('group')
    .map((group) => document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent);
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

async function pickMenu(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string) {
  await user.click(trigger);
  await user.click(await screen.findByRole('menuitemradio', { name: option }));
}

describe('composer model controls', () => {
  it('shows the default model, no agent chip (build mode only), and no effort for a model without variants', async () => {
    await mount();
    expect(screen.queryByRole('button', { name: /^agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^effort/i })).not.toBeInTheDocument();
  });

  it('chooses a model in the picker, then an effort, and the first send uses both', async () => {
    const { fake, user } = await mount();
    await openPicker(user);
    await user.type(within(picker()).getByRole('combobox', { name: 'Search models' }), 'opus');
    expect(options().map((o) => o.textContent)).toEqual([expect.stringContaining('Claude Opus 5.5')]);
    await user.click(options()[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chip()).toHaveAccessibleName('Model: Claude Opus 5.5');

    await pickMenu(user, screen.getByRole('button', { name: 'Effort: default' }), 'high');
    expect(screen.getByRole('button', { name: 'Effort: high' })).toBeInTheDocument();

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
    await user.click(options().find((o) => o.textContent?.includes('Claude Sonnet 5.5'))!);
    await pickMenu(user, await screen.findByRole('button', { name: 'Effort: default' }), 'low');
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
  it('lists providers, popular first, with the current model checked', async () => {
    const { user } = await mount();
    await openPicker(user);
    expect(groupTitles()).toEqual(['OpenCode', 'Anthropic']);
    const current = options().find((o) => o.getAttribute('aria-current') === 'true')!;
    expect(current).toHaveTextContent('Flint 40B Free');
  });

  it('moves with the arrow keys and chooses with Enter; effort is chosen in the prompt box', async () => {
    const { user } = await mount();
    await openPicker(user);
    expect(within(picker()).queryByRole('button', { name: /^effort/i })).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chip()).toHaveAccessibleName('Model: Claude Opus 5.5');
    expect(screen.getByRole('button', { name: 'Effort: default' })).toBeInTheDocument();
  });

  it('adds favorites (star or Ctrl+F) and lists them first; recent models follow', async () => {
    const { user } = await mount();
    await openPicker(user);
    await user.click(within(picker()).getByRole('button', { name: 'Add Claude Sonnet 5.5 to favorites' }));
    expect(groupTitles()[0]).toBe('Favorites');
    // Ctrl+F stars the highlighted row (the first search result).
    const search = within(picker()).getByRole('combobox', { name: 'Search models' });
    await user.type(search, 'opus');
    await user.keyboard('{Control>}f{/Control}');
    expect(within(picker()).getByRole('button', { name: 'Remove Claude Opus 5.5 from favorites' })).toBeInTheDocument();
    await user.clear(search);
    await user.click(options().find((o) => o.textContent?.includes('Flint 40B Free'))!);
    await openPicker(user);
    expect(groupTitles().slice(0, 2)).toEqual(['Favorites', 'Recent']);
    expect(options().slice(0, 3).map((o) => o.textContent)).toEqual([
      expect.stringContaining('Claude Opus 5.5'),
      expect.stringContaining('Claude Sonnet 5.5'),
      expect.stringContaining('Flint 40B Free'),
    ]);
  });

  it('collapses a provider group until a search', async () => {
    const { user } = await mount();
    await openPicker(user);
    await user.click(within(picker()).getByRole('button', { name: 'Collapse Anthropic' }));
    expect(within(picker()).getByRole('button', { name: 'Expand Anthropic' })).toHaveAttribute('aria-expanded', 'false');
    expect(options()).toHaveLength(1);
    await user.type(within(picker()).getByRole('combobox'), 'claude');
    expect(options()).toHaveLength(2);
  });

  it('hides a model from the picker in Manage models', async () => {
    const { user } = await mount();
    await openPicker(user);
    await user.click(within(picker()).getByRole('button', { name: 'Manage' }));
    await user.click(within(picker()).getByRole('switch', { name: 'Claude Opus 5.5' }));
    expect(within(picker()).getByRole('switch', { name: 'Anthropic' })).not.toBeChecked();
    await user.click(within(picker()).getByRole('button', { name: 'Back to models' }));
    expect(options().map((o) => o.textContent)).not.toContainEqual(expect.stringContaining('Claude Opus 5.5'));
  });
});

describe('model shortcuts', () => {
  it("opens the picker with Ctrl+' and cycles effort with Ctrl+Shift+D; Ctrl+. is left alone", async () => {
    const { user } = await mount();
    fireEvent.keyDown(window, { code: 'Quote', key: "'", ctrlKey: true });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(options().find((o) => o.textContent?.includes('Claude Opus 5.5'))!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.keyDown(window, { code: 'KeyD', key: 'D', ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole('button', { name: 'Effort: low' })).toBeInTheDocument();
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
    await waitFor(() => expect(chip()).toHaveAccessibleName('Model: Claude Opus 5.5'));
    expect(screen.getByRole('button', { name: 'Effort: low' })).toBeInTheDocument();
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
