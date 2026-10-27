import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';

function openSettings() {
  browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
}

function App() {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Opencode</h1>
        <Button type="button" variant="outline" size="sm" onClick={openSettings}>
          Settings
        </Button>
      </header>
      <p className="text-sm text-muted-foreground">hello</p>
    </div>
  );
}

export default App;
