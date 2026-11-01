import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChatSession } from '@/lib/opencode/chat';
import { describeError, isUnauthorized, PINNED_SERVER_VERSION } from '@/lib/opencode/client';
import type { Connection } from '@/lib/opencode/connection';
import { Composer } from './composer';
import { MessageList, type Turn } from './message-list';

type Props = {
  connection: Connection;
  /** The server rejected our token (HTTP 401). */
  onUnauthorized: () => void;
  onUnpair: () => void;
};

const DAY_MS = 86_400_000;
const EXPIRY_WARNING_DAYS = 5;

function Banner({ children }: { children: string }) {
  return <p className="bg-muted px-3 py-1.5 text-xs text-muted-foreground">{children}</p>;
}

export function ChatScreen({ connection, onUnauthorized, onUnpair }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const session = useRef<ChatSession | null>(null);
  const abort = useRef<AbortController | null>(null);
  const nextId = useRef(0);

  useEffect(() => () => abort.current?.abort(), []);

  const patch = (id: number, change: Partial<Turn>) =>
    setTurns((list) => list.map((t) => (t.id === id ? { ...t, ...change } : t)));

  const send = async (text: string) => {
    session.current ??= new ChatSession({ connection });
    const controller = new AbortController();
    abort.current = controller;
    const id = nextId.current++;
    setTurns((list) => [...list, { id, user: text, reply: null, error: null, pending: true }]);
    setBusy(true);
    try {
      await session.current.send(text, {
        signal: controller.signal,
        onUpdate: (reply) => patch(id, { reply }),
      });
      patch(id, { pending: false });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (isUnauthorized(error)) {
        onUnauthorized();
        return;
      }
      patch(id, { pending: false, error: describeError(error) });
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const daysLeft = Math.ceil((connection.expiresAt - Date.now()) / DAY_MS);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h1 className="text-sm font-semibold">Opencode</h1>
        <Button variant="ghost" size="sm" onClick={onUnpair}>
          Unpair
        </Button>
      </header>
      {connection.serverVersion && connection.serverVersion !== PINNED_SERVER_VERSION && (
        <Banner>{`Server is ${connection.serverVersion}; this extension was built for ${PINNED_SERVER_VERSION}.`}</Banner>
      )}
      {daysLeft <= EXPIRY_WARNING_DAYS && (
        <Banner>{`Pairing expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}. Pair again soon.`}</Banner>
      )}
      <MessageList turns={turns} />
      <Composer disabled={busy} onSend={(text) => void send(text)} />
    </div>
  );
}
