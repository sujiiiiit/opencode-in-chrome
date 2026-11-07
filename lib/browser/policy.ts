// The safety layer (spec browser/action-safety, design D9). Every page tool call passes the
// site gate; state-changing calls are also classified into a tier and gated by it. The rules
// live here, in the extension, so they hold whoever the caller is.
import { ToolError } from './tools/registry';
import type { KeyValue } from './tabs';
import type { PermissionMode } from '../opencode/permission-mode';

export type Tier = 'read' | 'navigate' | 'mutate' | 'consequential' | 'handoff';
export type SiteRule = 'allow' | 'ask' | 'block';
export type ApprovalMode = 'ask' | 'act';

export type SiteSettings = { rule: SiteRule; sensitive?: boolean; autoConsequential?: boolean };
export type PolicySettings = { mode: ApprovalMode; sites: Record<string, SiteSettings> };

const DEFAULT_POLICY: PolicySettings = { mode: 'ask', sites: {} };

/** What a guarded call is about (from the tool, the target element and the summary). */
export type GuardCall = {
  sessionID: string;
  tabId: number;
  tool: string;
  action: string;
  summary?: string;
  target?: unknown;
  /** For key presses: the keys (Enter inside a form submits it). */
  text?: string;
};

type TargetLike = { label?: string; secret?: string | null; submits?: boolean; inForm?: boolean; url?: string };

export type ApprovalRequest = {
  sessionID: string;
  kind: 'site' | 'action';
  site: string;
  tool: string;
  summary: string;
  tier: Tier;
};
export type ApprovalAnswer = 'once' | 'always' | 'deny' | 'timeout';

const CONSEQUENTIAL_WORDS =
  /\b(send|sends|pay|pays|payment|buy|buys|purchase|order|orders|checkout|check out|delete|deletes|remove|removes|post|posts|publish|publishes|submit|submits|confirm|confirms|sign ?up|signs up|register|transfer|transfers|subscribe|unsubscribe|book|reserve|donate|share|shares|invite|invites|approve|grant|authorize|merge|deploy|place order)\b/i;
const CAPTCHA = /captcha|recaptcha|hcaptcha|turnstile|challenges\.cloudflare\.com|arkoselabs|funcaptcha/i;
const OAUTH_CONSENT = /(\/oauth2?\/(authorize|auth|consent))|(\/o\/oauth2\/)|(consent\.)|(\/login\/oauth\/authorize)|(\/oauth\/authorize)/i;

/** Two-label public suffixes this build knows (a pragmatic subset of the public suffix list). */
const TWO_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in', 'co.jp', 'ne.jp', 'or.jp',
  'com.au', 'net.au', 'org.au', 'com.br', 'com.cn', 'com.mx', 'co.nz', 'co.za', 'com.sg', 'com.tr', 'co.kr',
  'github.io', 'vercel.app', 'netlify.app', 'pages.dev', 'web.app', 'herokuapp.com', 'blogspot.com', 'appspot.com',
]);

/** The site a URL belongs to (its registrable domain): `mail.google.com` → `google.com`. */
export function siteKey(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.startsWith('[')) return host; // localhost, IPs
  const labels = host.split('.');
  const lastTwo = labels.slice(-2).join('.');
  if (labels.length > 2 && TWO_LABEL_SUFFIXES.has(lastTwo)) return labels.slice(-3).join('.');
  return lastTwo;
}

/** The tier of a state-changing call (reads never reach here; they only pass the site gate). */
export function classify(call: GuardCall, pageUrl: string): Tier {
  const target = (call.target ?? {}) as TargetLike;
  const words = `${target.label ?? ''} ${call.summary ?? ''}`;
  if (needsHandOff(call, target, pageUrl)) return 'handoff';
  if (call.tool === 'javascript' || call.tool === 'file_upload' || call.tool === 'upload_image') return 'consequential';
  if (call.tool === 'navigate') return 'navigate';
  return target.submits || submitsWithEnter(call, target) || CONSEQUENTIAL_WORDS.test(words) ? 'consequential' : 'mutate';
}

function needsHandOff(call: GuardCall, target: TargetLike, pageUrl: string): boolean {
  if (secretHandOff(call, target)) return true;
  if (captchaPresent(target, pageUrl)) return true;
  return OAUTH_CONSENT.test(pageUrl) && call.tool !== 'navigate';
}

function secretHandOff(call: GuardCall, target: TargetLike): boolean {
  return !!target.secret && (call.tool === 'form_input' || (call.tool === 'computer' && call.action === 'type'));
}

function captchaPresent(target: TargetLike, pageUrl: string): boolean {
  return CAPTCHA.test(`${target.label ?? ''} ${target.url ?? ''}`) || CAPTCHA.test(pageUrl);
}

function submitsWithEnter(call: GuardCall, target: TargetLike): boolean {
  return call.tool === 'computer' && call.action === 'key' && !!target.inForm && /\b(enter|return)\b/i.test(call.text ?? '');
}

export type PolicyDeps = {
  store: KeyValue<PolicySettings>;
  permissionMode: () => Promise<PermissionMode>;
  approve: (request: ApprovalRequest) => Promise<ApprovalAnswer>;
  /** The URL the tab shows right now (for the pre-input re-check). */
  currentUrl: (tabId: number) => Promise<string>;
};

export class Policy {
  /** Sites allowed once in a session (ask sites). */
  private readonly allowedThisSession = new Map<string, Set<string>>();
  /** Sites marked sensitive that the session has read. */
  private readonly sensitiveRead = new Map<string, Set<string>>();
  private stopped = false;
  private readonly stopListeners = new Set<() => void>();

  constructor(private readonly deps: PolicyDeps) {}

  async settings(): Promise<PolicySettings> {
    const stored = await this.deps.store.get();
    return { mode: stored?.mode ?? 'ask', sites: { ...(stored?.sites ?? {}) } };
  }

  async setSite(site: string, value: SiteSettings | null): Promise<void> {
    const s = await this.settings();
    if (value) s.sites[site] = value;
    else delete s.sites[site];
    await this.deps.store.set(s);
  }

  // ---- kill switch ----
  get isStopped(): boolean {
    return this.stopped;
  }

  stop(): void {
    this.stopped = true;
    for (const l of this.stopListeners) l();
  }

  resume(): void {
    this.stopped = false;
  }

  onStop(listener: () => void): () => void {
    this.stopListeners.add(listener);
    return () => this.stopListeners.delete(listener);
  }

  assertRunning(): void {
    if (this.stopped) throw new ToolError('DENIED', 'The user stopped all browser activity. Wait until they resume it from the side panel.');
  }

  /**
   * The site gate every page tool passes (reads included): blocked sites fail; in manual
   * mode a site not yet allowed needs the user's OK once per session.
   */
  async siteGate(sessionID: string, url: string, tool: string, tier: Tier = 'read'): Promise<void> {
    this.assertRunning();
    const site = siteKey(url);
    if (!site) return;
    const settings = await this.settings();
    const rule = settings.sites[site]?.rule ?? 'ask';
    if (rule === 'block') {
      throw new ToolError('BLOCKED_SITE', `${site} is blocked in the browser settings. Do not try to reach it another way; ask the user.`);
    }
    this.trackSensitiveRead(sessionID, site, tier, settings);
    if (await this.deps.permissionMode() === 'auto') return;
    if (this.siteAllowed(sessionID, site, rule)) return;
    const answer = await this.deps.approve({ sessionID, kind: 'site', site, tool, summary: `Use ${site}`, tier });
    await this.applySiteAnswer(sessionID, site, answer, settings);
    this.assertRunning();
  }

  private async applySiteAnswer(sessionID: string, site: string, answer: ApprovalAnswer, settings: PolicySettings): Promise<void> {
    if (answer === 'always') return this.setSite(site, { ...(settings.sites[site] ?? {}), rule: 'allow' });
    if (answer === 'once') {
      const set = this.allowedThisSession.get(sessionID) ?? new Set();
      set.add(site);
      this.allowedThisSession.set(sessionID, set);
      return;
    }
    if (answer === 'timeout') throw new ToolError('NEEDS_APPROVAL', `The user did not answer whether the agent may use ${site}. Ask them in chat, then try again.`);
    throw new ToolError('DENIED', `The user did not allow the agent to use ${site}.`);
  }

  private markSensitiveRead(sessionID: string, site: string): void {
    const set = this.sensitiveRead.get(sessionID) ?? new Set();
    set.add(site);
    this.sensitiveRead.set(sessionID, set);
  }

  private trackSensitiveRead(sessionID: string, site: string, tier: Tier, settings: PolicySettings): void {
    if (settings.sites[site]?.sensitive && tier === 'read') this.markSensitiveRead(sessionID, site);
  }

  private siteAllowed(sessionID: string, site: string, rule: SiteRule): boolean {
    return rule === 'allow' || !!this.allowedThisSession.get(sessionID)?.has(site);
  }

  /**
   * The gate for a state-changing call, right before input reaches the page: re-checks the
   * site, refuses hand-off actions, and asks for consequential ones.
   */
  async guard(call: GuardCall, expectedUrl?: string): Promise<Tier> {
    this.assertRunning();
    const pageUrl = await this.deps.currentUrl(call.tabId);
    const target = (call.target ?? {}) as TargetLike;
    // Navigations are judged by where they go; everything else by the page they act on.
    const destination = target.url ?? pageUrl;
    let tier = classify(call, pageUrl);
    if (tier === 'handoff') {
      throw new ToolError('DENIED', `This step (${call.summary || call.action}) is for the user: passwords, one-time codes, card numbers, CAPTCHAs and sign-in consent screens are never done by the agent. Ask the user to do it, then continue.`);
    }
    const site = siteKey(destination);
    // After reading a sensitive site, sending anything to another site needs the user's OK.
    if (this.leavesSensitiveSite(call, site, tier)) {
      tier = 'consequential';
    }
    await this.siteGate(call.sessionID, destination, call.tool, tier);
    await this.approveAction(call, site, tier);
    // The tab may have moved while we waited: the approval was for that site only.
    await this.assertSiteUnchanged(call, expectedUrl ?? pageUrl);
    this.assertRunning();
    return tier;
  }

  private async assertSiteUnchanged(call: GuardCall, before: string): Promise<void> {
    if (call.tool === 'navigate') return;
    const now = await this.deps.currentUrl(call.tabId);
    if (siteKey(now) !== siteKey(before)) {
      throw new ToolError('NEEDS_APPROVAL', `The tab moved from ${siteKey(before)} to ${siteKey(now)} before the action ran, so nothing was done. Read the page again.`);
    }
  }

  private leavesSensitiveSite(call: GuardCall, site: string, tier: Tier): boolean {
    const read = this.sensitiveRead.get(call.sessionID);
    return !!(read?.size && site && !read.has(site) && (tier === 'navigate' || (tier === 'consequential' && call.tool !== 'javascript')));
  }

  private async approveAction(call: GuardCall, site: string, tier: Tier): Promise<void> {
    if (tier !== 'consequential' || await this.deps.permissionMode() === 'auto') return;
    const summary = call.summary || call.action;
    const answer = await this.deps.approve({ sessionID: call.sessionID, kind: 'action', site, tool: call.tool, summary, tier });
    if (answer === 'deny') throw new ToolError('DENIED', `The user declined: ${summary}. Do not retry it; ask what they want instead.`);
    if (answer === 'timeout') throw new ToolError('NEEDS_APPROVAL', `The user did not answer in time whether to: ${summary}. Ask them in chat.`);
  }
}

/** Stops the same failing call from being retried forever (spec: runaway loops). */
export class LoopGuard {
  private readonly last = new Map<string, { signature: string; failures: number }>();

  static signature(tool: string, args: Record<string, unknown>): string {
    const { action_summary: _summary, ...rest } = args;
    return `${tool}:${JSON.stringify(rest, Object.keys(rest).sort())}`;
  }

  /** Throws DENIED when this exact call already failed twice in a row in the session. */
  check(sessionID: string, signature: string): void {
    const entry = this.last.get(sessionID);
    if (entry && entry.signature === signature && entry.failures >= 2) {
      throw new ToolError('DENIED', 'This exact call already failed twice. Try a different approach (read the page again, use another element, or ask the user).');
    }
  }

  record(sessionID: string, signature: string, failed: boolean): void {
    const entry = this.last.get(sessionID);
    if (!failed) {
      this.last.delete(sessionID);
      return;
    }
    if (entry?.signature === signature) entry.failures += 1;
    else this.last.set(sessionID, { signature, failures: 1 });
  }

  // ─── No effect (spec browser/task-completion) ─────────────────────────────

  /** Per session: target key (`tab|tool action|target`) → no-effect count, and whether the tab was observed since. */
  private readonly noEffect = new Map<string, Map<string, { count: number; observed: boolean }>>();

  static targetKey(tabId: number, tool: string, action: string | undefined, target: string): string {
    return `${tabId}|${tool}${action ? ' ' + action : ''}|${target}`;
  }

  /** Throws NO_EFFECT, before any input, for a target that did nothing twice and was not looked at since. */
  checkEffect(sessionID: string, key: string): void {
    const entry = this.noEffect.get(sessionID)?.get(key);
    if (entry && entry.count >= NO_EFFECT_STOP && !entry.observed) {
      throw new ToolError(
        'NO_EFFECT',
        `This action had no visible effect ${entry.count} times on the same target, so it was not sent again. Read the page (read_page or find) to see why, try another way, or finish with done "partial" and tell the user.`,
      );
    }
  }

  /** Records an action's effect; returns a nudge for the result when the target keeps doing nothing. */
  recordEffect(sessionID: string, key: string, effect: 'changed' | 'none' | 'unknown' | undefined): string | undefined {
    const targets = this.noEffect.get(sessionID) ?? new Map<string, { count: number; observed: boolean }>();
    this.noEffect.set(sessionID, targets);
    if (effect === 'changed') {
      targets.delete(key);
      return undefined;
    }
    if (effect !== 'none') return undefined;
    const entry = targets.get(key) ?? { count: 0, observed: false };
    entry.count += 1;
    entry.observed = false;
    targets.set(key, entry);
    if (entry.count >= NO_EFFECT_NUDGE) {
      return `Note: this action had no effect ${entry.count} times on the same target. Try another way (another element, form_input, a key), or ask the user.`;
    }
    return undefined;
  }

  /** The session looked at the tab: refused targets on it may be tried again (their counts stay). */
  observed(sessionID: string, tabId: number): void {
    for (const [key, entry] of this.noEffect.get(sessionID) ?? []) if (key.startsWith(`${tabId}|`)) entry.observed = true;
  }

  /** `done` ends the task: counters start over. */
  resetSession(sessionID: string): void {
    this.noEffect.delete(sessionID);
    this.last.delete(sessionID);
  }
}

const NO_EFFECT_NUDGE = 2;
const NO_EFFECT_STOP = 2;
