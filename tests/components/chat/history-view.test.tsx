import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ChatScreen } from '@/components/chat/chat-screen';
import { BROWSER_ENABLED_KEY } from '@/lib/browser/settings';
import { ACTIVE_CHAT_KEY } from '@/lib/opencode/active-chat';
import type { Connection } from '@/lib/opencode/connection';
import { extensionSession, fakeOpencode, type FakeOpencode, type SessionRow } from '@/tests/support/queue-server';
import { BASE, SESSION_ID, TOKEN, jsonResponse } from '@/tests/support/testkit';

const connection: Connection = {
  baseUrl: BASE,
  token: TOKEN,
  expiresAt: Date.now() + 20 * 86_400_000,
  serverVersion: '2.2.5',
  pairedAt: 1,
};

beforeEach(() => fakeBrowser.storage.local.set({ [BROWSER_ENABLED_KEY]: false }));

const now = Date.now();
const transcript = [
  { id: 'msg_u1', type: 'user', text: 'How do I fix the login redirect?', time: { created: 1 } },
  {
    id: 'msg_a1',
    type: 'assistant',
    content: [{ type: 'text', text: 'Check the callback URL.' }],
    time: { created: 2 },
  },
  { id: 'msg_i1', type: 'idle', outcome: 'succeeded', time: { created: 3 } },
];
const loginChat = extensionSession(SESSION_ID, 'Fix login redirect', now - 60_000);
const cliChat: SessionRow = {
  id: 'ses_cli',
  title: 'CLI refactor',
  time: { created: now, updated: now },
  location: { directory: 'D:\\repo' },
};

function mount(fake: FakeOpencode) {
  vi.stubGlobal('fetch', fake.fetch);
  render(<ChatScreen connection={connection} onUnauthorized={vi.fn()} />);
  return { fake, user: userEvent.setup() };
}

const remember = (sessionID: string) =>
  fakeBrowser.storage.local.set({ [ACTIVE_CHAT_KEY]: { baseUrl: BASE, sessionID } });
const stored = async () => (await fakeBrowser.storage.local.get(ACTIVE_CHAT_KEY))[ACTIVE_CHAT_KEY];
const openHistory = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'History' }));

describe('ChatScreen: resuming', () => {
  it('reopens the chat the panel showed last', async () => {
    await remember(SESSION_ID);
    mount(fakeOpencode({ messages: transcript, sessions: [loginChat] }));
    expect(await screen.findByText('Check the callback URL.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Fix login redirect' })).toBeInTheDocument();
    // The page title follows in an effect after the heading renders.
    await waitFor(() => expect(document.title).toBe('Fix login redirect · Opencode'));
  });

  it('shows the title opencode generates after the first message', async () => {
    const { fake, user } = mount(fakeOpencode());
    expect(document.title).toBe('Opencode');
    await user.type(screen.getByRole('textbox', { name: /message/i }), 'how do I fix the login redirect{Enter}');
    await waitFor(() => expect(fake.prompts).toHaveLength(1));
    expect(await screen.findByRole('heading', { name: 'New chat' })).toBeInTheDocument();
    fake.emit('session.renamed', { title: 'Fix login redirect' });
    expect(await screen.findByRole('heading', { name: 'Fix login redirect' })).toBeInTheDocument();
    // The page title follows in an effect after the heading renders.
    await waitFor(() => expect(document.title).toBe('Fix login redirect · Opencode'));
  });

  it('remembers a new chat once its first message creates it', async () => {
    const { fake, user } = mount(fakeOpencode());
    expect(screen.getByRole('heading', { name: 'New chat' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /message/i }), 'hello{Enter}');
    await waitFor(() => expect(fake.prompts).toHaveLength(1));
    await waitFor(async () => expect(await stored()).toEqual({ baseUrl: BASE, sessionID: SESSION_ID }));
  });

  it('starts a new chat with a notice when the remembered one was deleted', async () => {
    await remember('ses_gone');
    const gone = () => jsonResponse({ _tag: 'SessionNotFoundError', message: 'Session not found' }, 404);
    mount(
      fakeOpencode({
        overrides: { 'GET /api/session/ses_gone/message': gone, 'GET /api/session/ses_gone/inbox': gone },
      }),
    );
    expect(await screen.findByText(/that chat was deleted/i)).toBeInTheDocument();
    await waitFor(async () => expect(await stored()).toBeUndefined());
  });
});

describe('ChatScreen: history', () => {
  it('lists only the extension’s chats, grouped by day', async () => {
    const { user } = mount(
      fakeOpencode({ sessions: [cliChat, loginChat, extensionSession('ses_old', 'Regex', now - 30 * 86_400_000)] }),
    );
    await openHistory(user);
    const today = await screen.findByRole('region', { name: 'Today' });
    expect(within(today).getByText('Fix login redirect')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^fix login redirect/i }).lastElementChild).toHaveClass('w-14', 'tabular-nums');
    expect(within(screen.getByRole('region', { name: 'Older' })).getByText('Regex')).toBeInTheDocument();
    expect(screen.queryByText('CLI refactor')).not.toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    const { user } = mount(fakeOpencode());
    await openHistory(user);
    expect(await screen.findByText('No chats yet.')).toBeInTheDocument();
  });

  it('opens a chat from the list and goes back to the conversation', async () => {
    const { user } = mount(fakeOpencode({ messages: transcript, sessions: [loginChat] }));
    await openHistory(user);
    await user.click(await screen.findByRole('button', { name: /^fix login redirect/i }));
    expect(await screen.findByText('Check the callback URL.')).toBeInTheDocument();
    // History slides out first, then leaves the page.
    await waitFor(() => expect(screen.queryByRole('searchbox', { name: /search chats/i })).not.toBeInTheDocument());
    await waitFor(async () => expect(await stored()).toEqual({ baseUrl: BASE, sessionID: SESSION_ID }));
  });

  it('keeps an unsent draft while History is open', async () => {
    const { user } = mount(fakeOpencode());
    await user.type(screen.getByRole('textbox', { name: /message/i }), 'half-written');
    await openHistory(user);
    await user.click(screen.getByRole('button', { name: /back to chat/i }));
    expect(screen.getByRole('textbox', { name: /message/i })).toHaveTextContent('half-written');
  });

  it('filters the loaded chats as you type, without asking the server when all are loaded', async () => {
    const { fake, user } = mount(
      fakeOpencode({ sessions: [loginChat, extensionSession('ses_regex', 'Regex help', now)] }),
    );
    await openHistory(user);
    await screen.findByText('Regex help');
    const row = screen.getByText('Fix login redirect');
    await user.type(screen.getByRole('searchbox', { name: /search chats/i }), 'LOGIN');
    await waitFor(() => expect(screen.queryByText('Regex help')).not.toBeInTheDocument());
    // The matching row stays the same element: it is not rebuilt (and does not blink).
    expect(screen.getByText('Fix login redirect')).toBe(row);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fake.listQueries.some((query) => query.has('search'))).toBe(false);
  });

  it('searches the server for chats beyond the loaded pages', async () => {
    const older = Array.from({ length: 34 }, (_, i) => extensionSession(`ses_${i}`, `Chat ${i}`, now - 1000 - i));
    const { fake, user } = mount(fakeOpencode({ sessions: [...older, loginChat] }));
    await openHistory(user);
    await screen.findByText('Chat 0');
    expect(screen.queryByText('Fix login redirect')).not.toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: /search chats/i }), 'login');
    expect(await screen.findByText('Fix login redirect')).toBeInTheDocument();
    expect(fake.listQueries.at(-1)!.get('search')).toBe('login');
    expect(screen.queryByText('Chat 0')).not.toBeInTheDocument();
  });

  it('keeps "no match" up, with no placeholder rows, while a wider search loads', async () => {
    const older = Array.from({ length: 34 }, (_, i) => extensionSession(`ses_${i}`, `Chat ${i}`, now - 1000 - i));
    const { user } = mount(fakeOpencode({ sessions: older }));
    await openHistory(user);
    await screen.findByText('Chat 0');
    const box = screen.getByRole('searchbox', { name: /search chats/i });
    await user.type(box, 'zzz');
    expect(await screen.findByText('No chats match your search.')).toBeInTheDocument();
    await user.type(box, 'z');
    expect(screen.queryByRole('list', { name: 'Loading chats' })).not.toBeInTheDocument();
    expect(screen.getByText('No chats match your search.')).toBeInTheDocument();
  });

  it('renames a chat inline', async () => {
    const { fake, user } = mount(fakeOpencode({ sessions: [loginChat] }));
    await openHistory(user);
    await user.click(await screen.findByRole('button', { name: /rename fix login redirect/i }));
    const field = await screen.findByRole('textbox', { name: /chat title/i });
    await user.clear(field);
    await user.type(field, 'Login callback{Enter}');
    expect(await screen.findByText('Login callback')).toBeInTheDocument();
    expect(fake.log).toContain(`rename:${SESSION_ID}:Login callback`);
  });

  it('deletes a chat after confirming in the row', async () => {
    const { fake, user } = mount(fakeOpencode({ sessions: [loginChat] }));
    await openHistory(user);
    await user.click(await screen.findByRole('button', { name: /^delete fix login redirect$/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /confirm delete fix login redirect/i }));
    await waitFor(() => expect(fake.log).toContain(`delete:${SESSION_ID}`));
    expect(await screen.findByText('No chats yet.')).toBeInTheDocument();
  });

  it('keeps the chat when the delete is cancelled', async () => {
    const { fake, user } = mount(fakeOpencode({ sessions: [loginChat] }));
    await openHistory(user);
    await user.click(await screen.findByRole('button', { name: /^delete fix login redirect$/i }));
    await user.click(await screen.findByRole('button', { name: /cancel deleting fix login redirect/i }));
    expect(fake.log).not.toContain(`delete:${SESSION_ID}`);
    expect(screen.getByText('Fix login redirect')).toBeInTheDocument();
  });

  it('leaves the open chat quietly when it is deleted from History', async () => {
    await remember(SESSION_ID);
    const { user } = mount(fakeOpencode({ messages: transcript, sessions: [loginChat] }));
    await screen.findByText('Check the callback URL.');
    await openHistory(user);
    await user.click(await screen.findByRole('button', { name: /^delete fix login redirect$/i }));
    await user.click(await screen.findByRole('button', { name: /confirm delete fix login redirect/i }));
    await user.click(screen.getByRole('button', { name: /back to chat/i }));
    expect(await screen.findByRole('heading', { name: 'New chat' })).toBeInTheDocument();
    expect(screen.queryByText('Check the callback URL.')).not.toBeInTheDocument();
    expect(screen.queryByText(/that chat was deleted/i)).not.toBeInTheDocument();
  });
});
