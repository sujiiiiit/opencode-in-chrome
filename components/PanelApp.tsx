import { browser } from 'wxt/browser';

function openSettings() {
  browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
}

function App() {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Opencode</h1>
        <button
          type="button"
          onClick={openSettings}
          className="rounded-md border border-ink-muted/30 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-ink-muted/10 dark:border-paper-soft/30 dark:hover:bg-paper/10"
        >
          Settings
        </button>
      </header>
      <p className="text-sm text-ink-muted dark:text-paper-soft">hello</p>
    </div>
  );
}

export default App;
