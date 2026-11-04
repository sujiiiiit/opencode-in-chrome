import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { Connection } from '@/lib/opencode/connection';
import { parsePairingInput } from '@/lib/opencode/link';
import { pairWithCode } from '@/lib/opencode/pair';
import { usePairing } from './use-pairing';

type Props = {
  onPaired: (connection: Connection) => void;
  /** A message shown above the form, for example after a rejected token. */
  notice?: string;
};

const fieldClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30';

export function PairScreen({ onPaired, notice }: Props) {
  const [input, setInput] = useState('');
  const { server, setServer, detected, session, busy, error, setError, attempt, connectSession } = usePairing(onPaired);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parsePairingInput(input, server);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    void attempt(() => pairWithCode({ baseUrl: parsed.baseUrl, code: parsed.code }));
  };

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4 text-foreground">
      <header>
        <h1 className="text-lg font-semibold">Connect to opencode</h1>
        <p className="text-sm text-muted-foreground">
          Run <code className="rounded bg-muted px-1">opencode pair</code> in a terminal and click the link it prints.
          This panel connects on its own.
        </p>
      </header>

      {notice && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{notice}</p>}

      {session && (
        <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-sm">You&apos;re signed in to opencode in this browser.</p>
          <Button type="button" disabled={busy} onClick={() => void connectSession(session)}>
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </section>
      )}

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

      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">Or paste the link instead:</p>
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
        <Button type="submit" variant={session ? 'outline' : 'default'} disabled={busy}>
          {busy ? 'Connecting…' : 'Connect with link'}
        </Button>
      </form>
    </main>
  );
}
