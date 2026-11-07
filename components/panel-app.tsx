import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { ChatScreen } from '@/components/chat/chat-screen';
import { PairScreen } from '@/components/pair/pair-screen';
import { clearConnection, CONNECTION_KEY, loadConnection, type Connection } from '@/lib/opencode/connection';

type View =
  | { name: 'loading' }
  | { name: 'pair'; notice?: string }
  | { name: 'chat'; connection: Connection };

const SESSION_EXPIRED = 'Session expired, pair again';

export default function PanelApp() {
  const tabIdValue = new URLSearchParams(window.location.search).get('tabId');
  const tabId = tabIdValue && /^\d+$/.test(tabIdValue) ? Number(tabIdValue) : undefined;
  const [view, setView] = useState<View>({ name: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let connectionChanged = false;
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !(CONNECTION_KEY in changes)) return;
      connectionChanged = true;
      if (changes[CONNECTION_KEY]?.newValue === undefined) setView({ name: 'pair' });
    };
    browser.storage.onChanged.addListener(onChanged);
    void loadConnection().then(async (connection) => {
      if (cancelled || connectionChanged) return;
      if (connection && connection.expiresAt > Date.now()) {
        setView({ name: 'chat', connection });
        return;
      }
      if (connection) await clearConnection();
      if (!cancelled) setView({ name: 'pair', notice: connection ? SESSION_EXPIRED : undefined });
    });
    return () => {
      cancelled = true;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const leave = async (notice?: string) => {
    await clearConnection();
    setView({ name: 'pair', notice });
  };

  if (view.name === 'loading') return null;
  if (view.name === 'pair') {
    return <PairScreen notice={view.notice} onPaired={(connection) => setView({ name: 'chat', connection })} />;
  }
  return <ChatScreen connection={view.connection} tabId={tabId} onUnauthorized={() => void leave(SESSION_EXPIRED)} />;
}
