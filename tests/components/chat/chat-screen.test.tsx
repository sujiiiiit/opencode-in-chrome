import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ChatScreen } from '@/components/chat/chat-screen';
import { BROWSER_ENABLED_KEY } from '@/lib/browser/settings';
import { PERMISSION_MODE_KEY } from '@/lib/opencode/permission-mode';
import type { Connection } from '@/lib/opencode/connection';
import { fakeOpencode, type FakeOpencode } from '@/tests/support/queue-server';
import { ASSISTANT_MSG_ID, BASE, MODELS, PROVIDER_ERROR, SESSION_ID, TOKEN, jsonResponse, routeFetch, sseStream, unauthorized } from '@/tests/support/testkit';
import { transfer } from '@/tests/support/transfer';

const connection: Connection = {
  baseUrl: BASE,
  token: TOKEN,
  expiresAt: Date.now() + 20 * 86_400_000,
  serverVersion: '2.2.5',
  pairedAt: 1,
};

beforeEach(() => fakeBrowser.storage.local.set({ [BROWSER_ENABLED_KEY]: false }));

const box = () => screen.getByRole('textbox', { name: /message/i });
const submitButton = () => screen.getByRole('button', { name: /^(send|stop)$/i });
const bubble = (text: string) =>
  screen.getAllByTestId('user-text').find((el) => el.textContent === text)!.closest<HTMLElement>('[data-slot="user-message"]')!;

function mount(fake: FakeOpencode = fakeOpencode(), onUnauthorized = vi.fn()) {
  vi.stubGlobal('fetch', fake.fetch);
  const view = render(<ChatScreen connection={connection} onUnauthorized={onUnauthorized} />);
  return { fake, onUnauthorized, user: userEvent.setup(), ...view };
}

/** Sends the first prompt and has the server start working on it. */
async function startTurn(fake: FakeOpencode, user: ReturnType<typeof userEvent.setup>, text = 'first') {
  await user.type(box(), `${text}{Enter}`);
  await waitFor(() => expect(fake.prompts).toHaveLength(1));
  fake.start();
  fake.deliver(fake.prompts[0]!.id);
  await waitFor(() => expect(submitButton()).toHaveAccessibleName('Stop'));
}

describe('ChatScreen: sending and the submit button', () => {
  it('changes the permission mode from the menu beside attachments', async () => {
    await fakeBrowser.storage.local.set({ [PERMISSION_MODE_KEY]: 'manual' });
    const { user } = mount();
    const trigger = await screen.findByRole('button', { name: 'OpenCode permissions: manual' });
    expect(screen.getByRole('button', { name: 'Add photos and files' }).parentElement).toBe(trigger.parentElement);
    await user.click(trigger);
    expect(screen.getByText('Permission')).toBeInTheDocument();
    await user.click(await screen.findByRole('menuitemradio', { name: 'Automatically approve' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'OpenCode permissions: auto' })).toBeInTheDocument());
    expect((await fakeBrowser.storage.local.get(PERMISSION_MODE_KEY))[PERMISSION_MODE_KEY]).toBe('auto');
    await fakeBrowser.storage.local.set({ [PERMISSION_MODE_KEY]: 'manual' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'OpenCode permissions: manual' })).toBeInTheDocument());
  });
  it('opens a running child, interrupts only that child and shows its outcome', async () => {
    const child = 'ses_child';
    const requests: URL[] = [];
    const fake = fakeOpencode({ overrides: {
      'GET /api/session/active': () => jsonResponse({ data: { [SESSION_ID]: {}, [child]: {} } }),
      [`GET /api/session/${child}`]: () => jsonResponse({ data: { id: child, agent: 'explore', time: { created: Date.now() - 5000, updated: Date.now() } } }),
      [`GET /api/session/${child}/message`]: () => jsonResponse({ data: [], cursor: { next: null } }),
      [`GET /api/session/${child}/inbox`]: () => jsonResponse({ data: [] }),
      [`GET /api/session/${child}/form`]: () => jsonResponse({ data: [] }),
      [`POST /api/session/${child}/interrupt`]: (call) => { requests.push(call.url); return jsonResponse({ interrupted: true }); },
    } });
    const { user } = mount(fake);
    await startTurn(fake, user);
    const event = { assistantMessageID: ASSISTANT_MSG_ID, id: 'call_child' };
    fake.emit('session.tool.input.started', { ...event, name: 'subagent' });
    fake.emit('session.tool.called', { ...event, input: { agent: 'explore', description: 'Inspect code' } });
    fake.emit('session.tool.progress', { ...event, metadata: { sessionID: child } });
    await user.click(await screen.findByRole('button', { name: /running explore agent/i }));
    await waitFor(() => expect(document.querySelector('[data-tool="subagent"]')).not.toBeNull());
    await user.click(document.querySelector<HTMLButtonElement>('[data-tool="subagent"]')!);
    expect(await screen.findByText(/\d+s/)).toBeVisible();
    expect(screen.getByText('· explore')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Stop subagent' }));
    expect(requests).toHaveLength(1);
    expect(requests[0]!.searchParams.has('resume')).toBe(false);
    fake.emit('session.execution.interrupted', { sessionID: child });
    expect(await screen.findByText(/Interrupted · \d+s/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Stop subagent' })).toBeNull();
  });
  it('copies the active session ID when the chat title is clicked', async () => {
    const { fake, user } = mount();
    expect(screen.queryByRole('button', { name: /Copy session ID/ })).not.toBeInTheDocument();
    await startTurn(fake, user);
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const copyButton = screen.getByRole('button', { name: /Copy session ID/ });
    await user.hover(copyButton);
    expect(await screen.findByText('Copy session ID')).toBeInTheDocument();
    await user.click(copyButton);
    expect(writeText).toHaveBeenCalledWith(SESSION_ID);
    expect(await screen.findByRole('status')).toHaveTextContent('Session ID copied');
    expect(document.querySelector('[data-slot="tooltip"]')).toHaveTextContent('Session ID copied');
    writeText.mockRestore();
  });

  it('keeps browser controls out of the composer', async () => {
    await fakeBrowser.storage.local.set({ [BROWSER_ENABLED_KEY]: true });
    mount();

    expect(screen.queryByRole('button', { name: 'Share this tab with the chat' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop browser activity' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume browser' })).not.toBeInTheDocument();
  });

  it('sends a message, clears the box and streams the reply', async () => {
    const { fake, user } = mount();
    await user.type(box(), 'hello{Enter}');
    await waitFor(() => expect(fake.prompts.map((p) => [p.text, p.delivery])).toEqual([['hello', 'steer']]));
    expect(box()).toBeEmptyDOMElement();
    expect(screen.getByText('hello')).toBeInTheDocument();

    fake.start();
    fake.deliver(fake.prompts[0]!.id);
    expect(await screen.findByText(/thinking/i)).toBeInTheDocument();
    fake.say('pong');
    expect(await screen.findByText('pong')).toBeInTheDocument();
    fake.finish();
    await waitFor(() => expect(submitButton()).toHaveAccessibleName('Send'));
    expect(submitButton()).toBeDisabled();
  });

  it('shows a 20-image prompt before reading its files for upload', async () => {
    const { fake, user } = mount();
    const read = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(() => undefined);
    try {
      await user.type(box(), 'look');
      await waitFor(() => expect(submitButton()).toBeEnabled());
      const files = Array.from({ length: 20 }, (_, at) => new File(['image'], `${at}.png`, { type: 'image/png' }));
      fireEvent.paste(box(), { clipboardData: transfer({ files }) });
      await user.keyboard('{Enter}');
      expect(box()).toBeEmptyDOMElement();
      expect(screen.getByText('look')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^Preview .*\.png$/ })).toHaveLength(20);
      expect(read).toHaveBeenCalledTimes(1);
      expect(fake.prompts).toHaveLength(0);
    } finally {
      read.mockRestore();
    }
  });

  it('holds a send while the models load, then sends the unchanged draft', async () => {
    let release!: () => void;
    const fake = fakeOpencode({
      overrides: {
        'GET /api/model': () => new Promise((resolve) => (release = () => resolve(jsonResponse(MODELS)))),
      },
    });
    const { user } = mount(fake);
    await user.type(box(), 'early{Enter}');
    expect(submitButton()).toHaveAttribute('data-state', 'held');
    expect(submitButton()).toHaveAttribute('aria-busy', 'true');
    expect(box()).toHaveTextContent('early');
    await waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await waitFor(() => expect(fake.prompts.map((p) => p.text)).toEqual(['early']));
    expect(box()).toBeEmptyDOMElement();
  });

  it('drops a held send when the draft changes', async () => {
    let release!: () => void;
    const fake = fakeOpencode({
      overrides: {
        'GET /api/model': () => new Promise((resolve) => (release = () => resolve(jsonResponse(MODELS)))),
      },
    });
    const { user } = mount(fake);
    await user.type(box(), 'early{Enter}');
    await user.type(box(), '!');
    expect(submitButton()).toHaveAttribute('data-state', 'send');
    await waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.prompts).toEqual([]);
    expect(box()).toHaveTextContent('early!');
  });

  it('cancels a held send on Escape and keeps the draft', async () => {
    let release!: () => void;
    const fake = fakeOpencode({
      overrides: {
        'GET /api/model': () => new Promise((resolve) => (release = () => resolve(jsonResponse(MODELS)))),
      },
    });
    const { user } = mount(fake);
    await user.type(box(), 'early{Enter}');
    await user.keyboard('{Escape}');
    expect(submitButton()).toHaveAttribute('data-state', 'send');
    await waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.prompts).toEqual([]);
    expect(box()).toHaveTextContent('early');
    expect(fake.interrupts).toEqual([]);
  });

  it('turns into Stop while a turn runs with an empty box, and interrupts with resume', async () => {
    const { fake, user } = mount();
    await startTurn(fake, user);
    expect(submitButton()).toBeEnabled();
    expect(box()).toHaveAttribute('aria-placeholder', 'Add a follow-up…');
    await user.click(submitButton());
    await waitFor(() => expect(fake.interrupts).toEqual([{ resume: 'true' }]));
    fake.finish('interrupted', { reason: 'user' });
    expect(await screen.findByText('Stopped before the reply finished.')).toBeInTheDocument();
    expect(submitButton()).toHaveAccessibleName('Send');
  });

  it('stops on Enter in an empty box and on Escape while a turn runs', async () => {
    const { fake, user } = mount();
    await startTurn(fake, user);
    await user.click(box());
    await user.keyboard('{Enter}');
    await waitFor(() => expect(fake.interrupts).toHaveLength(1));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(fake.interrupts).toHaveLength(2));
  });

  it('switches back to Send as soon as there is a follow-up to send', async () => {
    const { fake, user } = mount();
    await startTurn(fake, user);
    await user.type(box(), 'more');
    expect(submitButton()).toHaveAccessibleName('Send');
    expect(submitButton()).toBeEnabled();
  });

  it('keeps Send disabled while the event stream is reconnecting', async () => {
    const fake = fakeOpencode();
    const { user } = mount(fake);
    await user.type(box(), 'hello{Enter}');
    await waitFor(() => expect(fake.prompts).toHaveLength(1));
    // The next stream never says `server.connected`, so the panel stays disconnected.
    fake.hooks.onEvent = () => sseStream().response;
    fake.streams[0]!.close();
    await user.type(box(), 'next');
    await waitFor(() => expect(submitButton()).toBeDisabled());
  });

  it('shows a failed send as a notice and restores the draft', async () => {
    const fake = fakeOpencode();
    fake.hooks.beforePrompt = () => Promise.reject(new TypeError('Failed to fetch'));
    const { user } = mount(fake);
    await user.type(box(), 'my text{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/opencode service start/i);
    expect(box()).toHaveTextContent('my text');
    await user.click(within(alert).getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a load failure and retries it on send', async () => {
    let down = true;
    const fake = fakeOpencode();
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      down ? Promise.reject(new TypeError('Failed to fetch')) : fake.fetch(input, init),
    );
    render(<ChatScreen connection={connection} onUnauthorized={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/opencode service start/i);
    down = false;
    const user = userEvent.setup();
    await user.type(box(), 'retry{Enter}');
    await waitFor(() => expect(fake.prompts.map((p) => p.text)).toEqual(['retry']));
  });

  it('shows a model failure on the turn', async () => {
    const { fake, user } = mount();
    await startTurn(fake, user);
    fake.finish('failed', { error: PROVIDER_ERROR });
    await waitFor(() => expect(document.querySelector('[data-slot="assistant-error"]')).toHaveTextContent(`Model error: ${PROVIDER_ERROR.message}`));
  });

  it('calls onUnauthorized on a 401', async () => {
    const fake = fakeOpencode({ overrides: { 'GET /api/provider': () => unauthorized() } });
    const { onUnauthorized } = mount(fake);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
  });

  it('does not send an empty message', async () => {
    const { fake, user } = mount();
    await user.click(box());
    await user.keyboard('{Enter}');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.prompts).toEqual([]);
  });

  it('never parses server text as HTML', async () => {
    const evil = '<img src=x onerror=alert(1)><b>bold</b>';
    const { fake, user, container } = mount();
    await startTurn(fake, user);
    fake.say(evil);
    // The reply reads the tags as text (its live words sit in their own fade-in spans).
    await waitFor(() => expect(container.querySelector('[data-slot="assistant-reply"]')).toHaveTextContent(evil));
    expect(container.querySelector('img, b, [onerror]')).toBeNull();
  });

  it('New chat clears the conversation and the next message opens a new session', async () => {
    const { fake, user } = mount();
    await user.type(box(), 'hello{Enter}');
    await waitFor(() => expect(fake.prompts).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: /new chat/i }));
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    await user.type(box(), 'again{Enter}');
    await waitFor(() => expect(fake.log.filter((entry) => entry === 'create')).toHaveLength(2));
  });

  it('warns on a version mismatch and when the token is about to expire', () => {
    vi.stubGlobal('fetch', routeFetch({}));
    render(
      <ChatScreen
        connection={{ ...connection, serverVersion: '2.9.0', expiresAt: Date.now() + 2 * 86_400_000 }}
        onUnauthorized={vi.fn()}
      />,
    );
    expect(screen.getByText(/2\.9\.0/)).toBeInTheDocument();
    expect(screen.getByText(/expires in 2 days/i)).toBeInTheDocument();
  });
});

describe('ChatScreen: follow-ups', () => {
  it('sends a follow-up as a steer while a turn runs, shown dimmed until delivered', async () => {
    const { fake, user } = mount();
    await startTurn(fake, user);
    await user.type(box(), 'also check X{Enter}');
    await waitFor(() => expect(fake.prompts.at(-1)).toMatchObject({ text: 'also check X', delivery: 'steer' }));
    expect(box()).toBeEmptyDOMElement();
    await waitFor(() => expect(bubble('also check X')).toHaveAttribute('data-pending', 'true'));
    expect(screen.queryByText('Pending')).toBeNull();
  });

  it('steers on Ctrl+Enter too: there is no queue', async () => {
    const { fake, user } = mount();
    await startTurn(fake, user);
    await user.type(box(), 'later');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(fake.prompts.at(-1)).toMatchObject({ text: 'later', delivery: 'steer' }));
    expect(screen.queryByRole('list', { name: /queued prompts/i })).toBeNull();
  });

  it('offers no way to change or withdraw a sent prompt', async () => {
    const { fake, user } = mount();
    await startTurn(fake, user);
    await user.type(box(), 'sent{Enter}');
    await waitFor(() => expect(bubble('sent')).toBeTruthy());
    expect(within(bubble('sent')).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: /edit|steer|queue|delete|undo|remove/i })).toBeNull();
  });

  it('delivers a waiting prompt into the conversation as its own turn', async () => {
    const { fake, user } = mount();
    await startTurn(fake, user);
    fake.say('working');
    await user.type(box(), 'correction{Enter}');
    await waitFor(() => expect(fake.prompts).toHaveLength(2));
    fake.deliver(fake.prompts[1]!.id);
    fake.say('corrected', 'msg_assistant_2');
    expect(await screen.findByText('corrected')).toBeInTheDocument();
    expect(bubble('correction')).not.toHaveAttribute('data-pending');
  });
});

describe('ChatScreen: questions from the agent', () => {
  it('asks inside the prompt box, sends the answer and gives the box back', async () => {
    const fake = fakeOpencode({
      overrides: {
        [`POST /api/session/${SESSION_ID}/form/frm_q/reply`]: () => new Response(null, { status: 204 }),
      },
    });
    const { user } = mount(fake);
    await startTurn(fake, user);
    fake.emit('form.created', {
      form: {
        id: 'frm_q',
        sessionID: SESSION_ID,
        title: 'Questions',
        fields: [
          {
            key: 'q0',
            title: 'Video',
            description: 'What kind of video should I make?',
            type: 'string',
            custom: true,
            options: [{ value: 'Tutorial', label: 'Tutorial', description: 'Step-by-step guide' }],
          },
        ],
      },
    });
    const card = () => document.querySelector<HTMLElement>('[data-slot="prompt-box"]')!;
    expect(await within(card()).findByRole('heading', { name: 'What kind of video should I make?' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /message/i })).toBeNull();
    await user.click(within(card()).getByRole('radio', { name: /tutorial/i }));
    await user.click(within(card()).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(box()).toBeInTheDocument());
    const reply = fake.fetch.calls.find((call) => call.url.pathname.endsWith('/form/frm_q/reply'))!;
    expect(JSON.parse(String(reply.init.body))).toMatchObject({ answer: { q0: 'Tutorial' } });
  });
});

describe('Subagent permission routing', () => {
  it('shows child permissions in the main prompt and marks requests in another session', async () => {
    await fakeBrowser.storage.local.set({ [PERMISSION_MODE_KEY]: 'manual' });
    const child = 'ses_child';
    const fake = fakeOpencode({ overrides: {
      [`GET /api/session/${child}`]: () => jsonResponse({ data: { id: child, parentID: SESSION_ID, agent: 'explore', time: { created: Date.now(), updated: Date.now() } } }),
      [`GET /api/session/${child}/message`]: () => jsonResponse({ data: [], cursor: { next: null } }),
      [`GET /api/session/${child}/inbox`]: () => jsonResponse({ data: [] }),
      [`POST /api/session/${child}/permission/perm_child/reply`]: () => new Response(null, { status: 204 }),
    } });
    const { user } = mount(fake);
    await startTurn(fake, user);
    const event = { assistantMessageID: ASSISTANT_MSG_ID, id: 'call_child' };
    fake.emit('session.tool.input.started', { ...event, name: 'subagent' });
    fake.emit('session.tool.called', { ...event, input: { agent: 'explore', description: 'Inspect code' } });
    fake.emit('session.tool.progress', { ...event, metadata: { sessionID: child } });
    fake.emit('permission.asked', { id: 'perm_child', sessionID: child, action: 'edit', resources: ['child.ts'] });
    expect(await screen.findByText('Subagent request')).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'Allow once' }));
    await waitFor(() => expect(fake.fetch.calls.some((call) => call.url.pathname === `/api/session/${child}/permission/perm_child/reply`)).toBe(true));
    const group = (await screen.findAllByRole('button', { name: /running explore agent/i })).find((button) => button.dataset.slot === 'collapsible-trigger');
    if (group?.getAttribute('aria-expanded') !== 'true') await user.click(group!);
    await user.click(document.querySelector<HTMLButtonElement>('[data-tool="subagent"]')!);
    await screen.findByRole('button', { name: /Back to main chat/ });
    fake.emit('permission.asked', { id: 'perm_root', sessionID: SESSION_ID, action: 'execute', resources: ['command'] });
    expect(await screen.findByRole('status', { name: 'Another chat needs approval' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Back to main chat/ }));
    expect(await screen.findByText('Allow execute?')).toBeVisible();
  });
});
