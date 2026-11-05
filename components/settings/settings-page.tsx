import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Icon, type IconName } from '@/components/ui/icon';
import { loadConnection, type Connection } from '@/lib/opencode/connection';
import { BrowserSection } from './browser-section';
import { ModelsSection, type ModelsPreview } from './models-section';
import { WebSearchSection } from './web-search-section';

type Page = 'models' | 'web-search' | 'browser';

const PAGES: Array<{ id: Page; label: string; description: string; icon: IconName }> = [
  { id: 'models', label: 'Models', description: 'Choose which models of each provider appear in the model picker.', icon: 'sliders' },
  { id: 'web-search', label: 'Web search', description: 'Choose the search backend your chats use.', icon: 'globe' },
  { id: 'browser', label: 'Browser', description: 'Let chats read and act in your browser, and choose what needs your OK.', icon: 'browser' },
];

/** While developing, `?preview=loading` or `?preview=empty` shows those states of the Models page. */
function devPreview(): ModelsPreview | undefined {
  if (!import.meta.env.DEV) return undefined;
  const value = new URLSearchParams(window.location.search).get('preview');
  return value === 'loading' || value === 'empty' ? value : undefined;
}

export function SettingsPage() {
  const [page, setPage] = useState<Page>('models');
  const [connection, setConnection] = useState<Connection | null | undefined>(undefined);

  useEffect(() => {
    void loadConnection().then(setConnection, () => setConnection(null));
  }, []);

  // The ScrollArea below is the page's only scroller. The model card floats in a layer on <body>;
  // when it glides near the window's edge it can stick out and give the document its own native
  // scrollbar beside ours, so the document itself is not allowed to scroll on this page.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  const current = PAGES.find((item) => item.id === page)!;

  return (
    <ScrollArea className="h-screen bg-background text-text-primary">
    <div className="mx-auto flex w-full max-w-5xl items-start">
      <nav aria-label="Settings" className="sticky top-0 flex w-60 shrink-0 flex-col gap-1 px-3 py-10">
        <h1 className="mb-6 px-3 text-xl font-semibold">Settings</h1>
        {PAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={item.id === page ? 'page' : undefined}
            onClick={() => setPage(item.id)}
            className="flex h-9 cursor-pointer items-center gap-2.5 rounded-2xl px-3 text-left text-sm text-text-secondary outline-none transition-colors hover:bg-background-tertiary-transparent hover:text-text-primary focus-visible:ring-3 focus-visible:ring-ring/30 aria-[current=page]:bg-background-tertiary-transparent aria-[current=page]:text-text-primary"
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>
      <main className="min-w-0 flex-1">
        <div className="w-full space-y-6 px-8 py-10">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold">{current.label}</h2>
            <p className="text-sm text-text-secondary">{current.description}</p>
          </header>
          <SettingsContent page={page} connection={connection} />
        </div>
      </main>
    </div>
    </ScrollArea>
  );
}

function SettingsContent({ page, connection }: { page: Page; connection: Connection | null | undefined }) {
  if (page === 'browser') return <BrowserSection />;
  if (connection === undefined) return null;
  if (connection === null) return <p className="text-sm text-text-secondary">Pair the extension from its side panel to manage these settings.</p>;
  return <ConnectedSettings page={page} connection={connection} />;
}

function ConnectedSettings({ page, connection }: { page: Page; connection: Connection }) {
  return page === 'models' ? <ModelsSection connection={connection} preview={devPreview()} /> : <WebSearchSection connection={connection} />;
}
