import { useEffect, useRef, useState } from 'react';
import { findBrowserSession, watchBrowserSession, type BrowserSession } from '@/lib/opencode/browser-session';
import type { Connection } from '@/lib/opencode/connection';
import { connectWithToken, detectServer, type PairResult } from '@/lib/opencode/pair';

/**
 * Pairing state for the pair screen: finds the local server and any opencode
 * session already in this browser, and connects on its own when a pairing link
 * is opened in a tab. `attempt` runs one pairing at a time.
 */
export function usePairing(onPaired: (connection: Connection) => void) {
  const [server, setServer] = useState('');
  const [detected, setDetected] = useState<'pending' | 'found' | 'none'>('pending');
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const attempt = async (pair: () => Promise<PairResult>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setBusy(true);
    const result = await pair();
    busyRef.current = false;
    setBusy(false);
    if (result.ok) onPaired(result.connection);
    else setError(result.message);
  };
  const connectSession = (found: BrowserSession) => attempt(() => connectWithToken(found));
  // The cookie watcher outlives renders; keep it pointed at the latest closure.
  const connectSessionRef = useRef(connectSession);
  connectSessionRef.current = connectSession;

  useEffect(() => {
    let cancelled = false;
    void detectServer().then(async (baseUrl) => {
      if (cancelled) return;
      if (baseUrl) setServer((current) => current || baseUrl);
      setDetected(baseUrl ? 'found' : 'none');
      const found = await findBrowserSession(baseUrl);
      if (!cancelled) setSession(found);
    });
    const unwatch = watchBrowserSession((found) => void connectSessionRef.current(found));
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

  return { server, setServer, detected, session, busy, error, setError, attempt, connectSession };
}
