import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { siteKey, type ApprovalMode, type PolicySettings, type SiteSettings } from '@/lib/browser/policy';
import {
  BROWSER_ENABLED_KEY,
  isBrowserAccessEnabled,
  loadPolicy,
  POLICY_KEY,
  setApprovalMode,
  setBrowserAccess,
  setSiteSettings,
} from '@/lib/browser/settings';

export type BrowserSettingsState = { enabled: boolean; policy: PolicySettings };

/** `https://mail.google.com/x`, `mail.google.com` or `google.com` → `google.com`. */
export function siteFromInput(input: string): string {
  const text = input.trim().toLowerCase();
  if (!text) return '';
  return siteKey(/^[a-z][a-z0-9+.-]*:\/\//.test(text) ? text : `https://${text}`);
}

/** The browser-agent settings, kept in step with storage (the worker changes sites too). */
export function useBrowserSettings() {
  const [state, setState] = useState<BrowserSettingsState | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [enabled, policy] = await Promise.all([isBrowserAccessEnabled(), loadPolicy()]);
      if (alive) setState({ enabled, policy });
    };
    void load();
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && (BROWSER_ENABLED_KEY in changes || POLICY_KEY in changes)) void load();
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const setEnabled = useCallback((enabled: boolean) => setBrowserAccess(enabled), []);
  const setMode = useCallback((mode: ApprovalMode) => setApprovalMode(mode), []);
  const setSite = useCallback((site: string, value: SiteSettings | null) => setSiteSettings(site, value), []);

  return { state, setEnabled, setMode, setSite };
}
