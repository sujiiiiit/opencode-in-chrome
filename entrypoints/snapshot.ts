// Injected by the browser agent into every frame of an agent tab (ISOLATED world) with
// chrome.scripting.executeScript({ files: ['/snapshot.js'], allFrames: true }). It installs
// the page API the service worker then calls (lib/browser/page/page-api.ts).
import { browser } from 'wxt/browser';
import { installPageApi } from '@/lib/browser/page/page-api';

export default defineUnlistedScript(() => {
  installPageApi(globalThis as unknown as Record<string, unknown>, document, {
    // Closed shadow roots are reachable from extension content scripts only.
    shadowRootOf: (el) => {
      try {
        return browser.dom?.openOrClosedShadowRoot(el as HTMLElement) ?? null;
      } catch {
        return null;
      }
    },
  });
});
