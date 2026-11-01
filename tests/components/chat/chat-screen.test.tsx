import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Connection } from '@/lib/opencode/connection';
import {
  ASSISTANT_MSG_ID,
  BASE,
  SESSION_ID,
  TOKEN,
  evt,
  failureEvents,
  fakeServer,
  pushEvents,
  routeFetch,
  successEvents,
  unauthorized,
} from '@/tests/support/testkit';
import { ChatScreen } from '@/components/chat/chat-screen';

const connection: Connection = {
  baseUrl: BASE,
  token: TOKEN,
  expiresAt: Date.now() + 20 * 86_400_000,
  serverVersion: '2.2.5',
  pairedAt: 1,
};

const type = async (text: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: /message/i }), text);
  await user.keyboard('{Enter}');
};

const noop = () => undefined;

describe('ChatScreen', () => {
  it('sends a message, streams the reply and re-enables the input when done', async () => {
    const server = fakeServer();
    vi.stubGlobal('fetch', server.fetch);
    render(<ChatScreen connection={connection} onUnauthorized={noop} onUnpair={noop} />);
    await type('hello');

    expect(await screen.findByText('hello')).toBeInTheDocument();
    await waitFor(() => expect(server.order).toContain('prompt'));
    expect(screen.getByRole('textbox', { name: /message/i })).toBeDisabled();
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();

    const events = successEvents();
    pushEvents(server.streams[0], events.slice(0, 10)); // up to the first "po"
    expect(await screen.findByText('po')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /message/i })).toBeDisabled();

    pushEvents(server.streams[0], events.slice(10));
    expect(await screen.findByText('pong')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /message/i })).toBeEnabled());
  });

  it('shows reasoning collapsed', async () => {
    const server = fakeServer({ onPrompt: (s) => pushEvents(s[0], successEvents()) });
    vi.stubGlobal('fetch', server.fetch);
    render(<ChatScreen connection={connection} onUnauthorized={noop} onUnpair={noop} />);
    await type('hello');
    await screen.findByText('pong');
    const details = screen.getByText('The user wants pong.').closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
  });

  it('shows a tool placeholder for tool steps', async () => {
    const s = { sessionID: SESSION_ID, assistantMessageID: ASSISTANT_MSG_ID };
    const server = fakeServer({
      onPrompt: (streams) =>
        pushEvents(streams[0], [
          evt('session.execution.started', { sessionID: SESSION_ID }, { location: false }),
          evt('session.step.started', s),
          evt('session.tool.input.started', { ...s, id: 'c1', name: 'read' }),
          evt('session.text.ended', { ...s, ordinal: 0, text: 'done' }),
          evt('session.execution.succeeded', { sessionID: SESSION_ID }, { location: false }),
        ]),
    });
    vi.stubGlobal('fetch', server.fetch);
    render(<ChatScreen connection={connection} onUnauthorized={noop} onUnpair={noop} />);
    await type('list files');
    expect(await screen.findByText(/used tool: read/i)).toBeInTheDocument();
  });

  it('shows a model error in the assistant bubble', async () => {
    const server = fakeServer({ onPrompt: (s) => pushEvents(s[0], failureEvents()) });
    vi.stubGlobal('fetch', server.fetch);
    render(<ChatScreen connection={connection} onUnauthorized={noop} onUnpair={noop} />);
    await type('hello');
    expect(await screen.findByText(/Model error: The requested model is not supported\./)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /message/i })).toBeEnabled());
  });

  it('shows an offline message and keeps the input usable', async () => {
    vi.stubGlobal('fetch', routeFetch({}));
    render(<ChatScreen connection={connection} onUnauthorized={noop} onUnpair={noop} />);
    await type('hello');
    expect(await screen.findByText(/opencode service start/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /message/i })).toBeEnabled());
  });

  it('calls onUnauthorized on a 401', async () => {
    const server = fakeServer({ overrides: { 'GET /api/event': () => unauthorized() } });
    vi.stubGlobal('fetch', server.fetch);
    const onUnauthorized = vi.fn();
    render(<ChatScreen connection={connection} onUnauthorized={onUnauthorized} onUnpair={noop} />);
    await type('hello');
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it('does not send an empty message', async () => {
    const server = fakeServer();
    vi.stubGlobal('fetch', server.fetch);
    render(<ChatScreen connection={connection} onUnauthorized={noop} onUnpair={noop} />);
    await userEvent.setup().click(screen.getByRole('textbox', { name: /message/i }));
    await userEvent.setup().keyboard('{Enter}');
    expect(server.fetch.calls).toHaveLength(0);
  });

  it('renders server text as plain text, never HTML', async () => {
    const evil = '<img src=x onerror=alert(1)><b>bold</b>';
    const server = fakeServer({ onPrompt: (s) => pushEvents(s[0], successEvents(SESSION_ID, [evil], evil)) });
    vi.stubGlobal('fetch', server.fetch);
    const { container } = render(<ChatScreen connection={connection} onUnauthorized={noop} onUnpair={noop} />);
    await type('hello');
    await screen.findByText(evil);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('offers Unpair', async () => {
    vi.stubGlobal('fetch', routeFetch({}));
    const onUnpair = vi.fn();
    render(<ChatScreen connection={connection} onUnauthorized={noop} onUnpair={onUnpair} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /unpair/i }));
    expect(onUnpair).toHaveBeenCalled();
  });

  it('warns on a version mismatch and when the token is about to expire', () => {
    vi.stubGlobal('fetch', routeFetch({}));
    render(
      <ChatScreen
        connection={{ ...connection, serverVersion: '2.9.0', expiresAt: Date.now() + 2 * 86_400_000 }}
        onUnauthorized={noop}
        onUnpair={noop}
      />,
    );
    expect(screen.getByText(/2\.9\.0/)).toBeInTheDocument();
    expect(screen.getByText(/expires in 2 days/i)).toBeInTheDocument();
  });
});
