import { useEffect, useRef, useState, type FormEvent } from 'react';
import logoLight from '@/assets/opencode-logo-light.svg';
import logoDark from '@/assets/opencode-logo-dark.svg';
import { Button } from '@/components/ui/button';
import { Icon, Tick2Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsContentWrapper } from '@/components/ui/tabs';
import type { Connection } from '@/lib/opencode/connection';
import { parsePairingInput } from '@/lib/opencode/link';
import { pairWithCode } from '@/lib/opencode/pair';
import { usePairing } from './use-pairing';

type Props = {
  onPaired: (connection: Connection) => void;
  notice?: string;
};

const fieldClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 font-sans text-sm font-normal text-text-primary outline-none placeholder:font-normal placeholder:text-text-tertiary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30';

export function PairScreen({ onPaired, notice }: Props) {
  const [input, setInput] = useState('');
  const [showPairing, setShowPairing] = useState(false);
  const [view, setView] = useState('connect');
  const { server, setServer, session, busy, error, setError, attempt, connectSession } = usePairing(onPaired);
  const parsed = parsePairingInput(input, server);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    void attempt(() => pairWithCode({ baseUrl: parsed.baseUrl, code: parsed.code }));
  };

  return (
    <Tabs defaultValue="connect" value={view} onValueChange={setView} className="h-screen gap-0 overflow-hidden bg-background font-sans text-text-primary">
      <header className="flex h-12 shrink-0 items-center px-3">
        {view === 'settings' ? (
          <>
            <Button type="button" variant="ghost" size="icon-lg" aria-label="Back to connect" onClick={() => setView('connect')}><Icon name="arrow-left" /></Button>
            <h2 className="ml-2 text-sm font-medium">Server settings</h2>
          </>
        ) : (
          <Button type="button" variant="ghost" size="icon-lg" className="ml-auto" aria-label="Server settings" onClick={() => setView('settings')}><Icon name="settings" /></Button>
        )}
      </header>
      <TabsContentWrapper fillHeight className="min-h-0 flex-1 overflow-hidden">
        <TabsContent value="connect">
    <main className="flex h-full items-center justify-center overflow-auto px-6 pb-20 text-text-primary">
      <div className="flex w-full max-w-xs flex-col gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <img src={logoLight} alt="" width={40} height={50} className="dark:hidden" />
          <img src={logoDark} alt="" width={40} height={50} className="hidden dark:block" />
          <h1 className="text-xl font-semibold tracking-tight">Connect to OpenCode</h1>
        </header>

        {notice && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{notice}</p>}
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {session && (
          <section className="flex flex-col gap-3 text-center">
            <p className="text-sm text-text-secondary">Session found in this browser</p>
            <Button type="button" className="h-9.5" disabled={busy} onClick={() => void connectSession(session)}>
              {busy ? 'Connecting…' : 'Connect'}
            </Button>
            {!showPairing && <button type="button" onClick={() => setShowPairing(true)} className="cursor-pointer text-xs text-text-secondary hover:text-text-primary">Use a pairing link</button>}
          </section>
        )}

        {(!session || showPairing) && <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span className="sr-only">Pairing link or code</span>
            <input className={fieldClass} value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your pairing link or code" spellCheck={false} autoComplete="off" />
          </label>
          <Button type="submit" className="h-9.5" variant={session ? 'outline' : 'default'} disabled={busy || !parsed.ok}>
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </form>}

        <section className="space-y-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <p className="text-xs text-text-secondary">Need a link?</p>
            <CopyCommand />
          </div>
        </section>
      </div>
    </main>
        </TabsContent>
        <TabsContent value="settings">
          <section className="w-full px-4 pt-6">
            <label className="flex flex-col gap-2 text-xs text-text-secondary">
              Server address
              <input className={fieldClass} value={server} onChange={(e) => setServer(e.target.value)}
                placeholder="http://127.0.0.1:28894" spellCheck={false} autoComplete="off" />
            </label>
          </section>
        </TabsContent>
      </TabsContentWrapper>
    </Tabs>
  );
}

function CopyCommand() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText('opencode pair');
      setStatus('copied');
      timer.current = setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('failed');
    }
  };

  return (
    <>
      <button type="button" onClick={() => void copy()} aria-label={status === 'copied' ? 'Command copied' : 'Copy opencode pair command'}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
        <code className="font-sans text-xs text-text-primary">opencode pair</code>
        <span className="text-text-secondary" aria-hidden="true">
          {status === 'copied' ? <Tick2Icon className="size-3.5" /> : <Icon name="copy" className="size-3.5" />}
        </span>
      </button>
      <span className="sr-only" role="status">{status === 'copied' ? 'Copied' : ''}</span>
      {status === 'failed' && <p role="alert" className="text-xs text-destructive">Could not copy. Select and copy the command above.</p>}
    </>
  );
}
