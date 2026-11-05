// Wires the browser agent into the background service worker: the bridge follows the
// browser-access setting and the stored pairing, and an alarm restarts it after the
// worker was stopped while idle (the server sends nothing on an idle socket, design D3).
import { browser } from 'wxt/browser';
import { CONNECTION_KEY } from '../opencode/connection';
import { Bridge, type BridgeOptions } from './bridge';
import { BROWSER_ENABLED_KEY, isBrowserAccessEnabled } from './settings';

export const BRIDGE_ALARM = 'opencode.browser.bridge';
const BRIDGE_STATE_REQUEST = 'opencode.bridge.state';
const ALARM_PERIOD_MINUTES = 0.5;

/**
 * Registers every listener synchronously (MV3 workers must, to be woken by them) and
 * returns the bridge plus `sync`, which brings it in line with the setting.
 */
export function startBrowserAgent(options: BridgeOptions) {
  const bridge = new Bridge(options);

  const sync = async () => {
    if (await isBrowserAccessEnabled()) bridge.start();
    else await bridge.stop();
  };

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    // Re-paired or unpaired: drop the old socket, then reconnect if still enabled.
    if (CONNECTION_KEY in changes) void bridge.stop().then(sync);
    else if (BROWSER_ENABLED_KEY in changes) void sync();
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === BRIDGE_ALARM) void sync();
  });
  browser.runtime.onStartup.addListener(() => void sync());
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if ((message as { type?: string } | null)?.type !== BRIDGE_STATE_REQUEST) return undefined;
    if (sender.id !== browser.runtime.id || !sender.url?.startsWith(browser.runtime.getURL('/'))) return undefined;
    sendResponse({ state: bridge.state });
    return true;
  });
  void browser.alarms.create(BRIDGE_ALARM, { periodInMinutes: ALARM_PERIOD_MINUTES });
  void sync();

  return { bridge, sync };
}
