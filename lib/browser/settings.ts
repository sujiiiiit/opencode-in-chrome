// User settings for the browser agent, kept in storage.local (never sync): whether browser
// access is on, the approval mode, and the per-site rules (spec chat/browser-activity).
import { browser } from 'wxt/browser';
import type { ApprovalMode, PolicySettings, SiteSettings } from './policy';

/** Browser access is on by default; an explicit false turns it off. */
export const BROWSER_ENABLED_KEY = 'opencode.browser.enabled';
export const POLICY_KEY = 'opencode.browser.policy';
/** storage.session: each session's tab group and tabs (lib/browser/tabs.ts). */
export const TABS_KEY = 'opencode.browser.tabs';
/** storage.session: true while the user has stopped all browser activity. */
export const STOPPED_KEY = 'opencode.browser.stopped';

export async function isBrowserAccessEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get(BROWSER_ENABLED_KEY);
  return stored[BROWSER_ENABLED_KEY] !== false;
}

export async function setBrowserAccess(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [BROWSER_ENABLED_KEY]: enabled });
}

export async function loadPolicy(): Promise<PolicySettings> {
  const stored = (await browser.storage.local.get(POLICY_KEY))[POLICY_KEY] as Partial<PolicySettings> | undefined;
  return { mode: stored?.mode === 'act' ? 'act' : 'ask', sites: { ...(stored?.sites ?? {}) } };
}

async function savePolicy(policy: PolicySettings): Promise<void> {
  await browser.storage.local.set({ [POLICY_KEY]: policy });
}

export async function setApprovalMode(mode: ApprovalMode): Promise<void> {
  await savePolicy({ ...(await loadPolicy()), mode });
}

/** Sets (or, with null, removes) one site's settings. */
export async function setSiteSettings(site: string, value: SiteSettings | null): Promise<void> {
  const policy = await loadPolicy();
  if (value) policy.sites[site] = value;
  else delete policy.sites[site];
  await savePolicy(policy);
}
