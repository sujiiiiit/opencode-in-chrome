import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { Connection } from '@/lib/opencode/connection';
import { parsePairingInput } from '@/lib/opencode/link';
import { detectServer, pairWithCode } from '@/lib/opencode/pair';

type Props = {
  onPaired: (connection: Connection) => void;
  /** A message shown above the form, for example after a rejected token. */
  notice?: string;
};

const fieldClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30';

export function PairScreen({ onPaired, notice }: Props) {
  const [input, setInput] = useState('');
  const [server, setServer] = useState('');
  const [detected, setDetected] = useState<'pending' | 'found' | 'none'>('pending');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void detectServer().then((baseUrl) => {
      if (cancelled) return;
      if (baseUrl) setServer((current) => current || baseUrl);
      setDetected(baseUrl ? 'found' : 'none');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = parsePairingInput(input, server);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setBusy(true);
    const result = await pairWithCode({ baseUrl: parsed.baseUrl, code: parsed.code });
    setBusy(false);
    if (result.ok) onPaired(result.connection);
    else setError(result.message);
  };

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4 text-foreground">
      <header>
        <h1 className="text-lg font-semibold">Connect to opencode</h1>
        <p className="text-sm text-muted-foreground">
          Run <code className="rounded bg-muted px-1">opencode pair</code> in a terminal, then copy the link — don&apos;t open
          it in a browser.
        </p>
      </header>

      {notice && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{notice}</p>}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Pairing link or code
          <textarea
            className={`${fieldClass} min-h-20 resize-none font-mono text-xs`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="http://127.0.0.1:28894/auth/connect/…"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Server address
          <input
            className={fieldClass}
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="http://127.0.0.1:28894"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        {detected === 'none' && (
          <p className="text-xs text-muted-foreground">
            No local server found. Run <code>opencode service start</code> (or just <code>opencode pair</code>, which starts it).
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Connecting…' : 'Connect'}
        </Button>
      </form>
    </main>
  );
}
