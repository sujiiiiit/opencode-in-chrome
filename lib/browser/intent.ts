// The action check (S5 in docs/browser-automation-coverage.md): an action must not send data
// to a destination only the page asked for. Prompt injection almost always ends with the
// agent writing an attacker's address or site into a field, or sending to it, so this checks
// the email addresses and web domains in what an action carries against the user's own
// messages and the site being worked on. No model call: it is instant and costs no tokens.
import { siteKey } from './site';

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const URL_RE = /\bhttps?:\/\/[^\s"'<>()]+/gi;
const DOMAIN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi;
/** Endings that make `name.ext` a file name, not a domain. */
const FILE_ENDINGS = new Set(['html', 'htm', 'php', 'asp', 'aspx', 'jsp', 'js', 'ts', 'tsx', 'css', 'json', 'xml', 'txt', 'csv', 'md', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'zip', 'gz', 'tar', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'mp3', 'mp4', 'mov', 'exe', 'dmg', 'py', 'rb', 'go', 'rs', 'java', 'sh', 'yml', 'yaml', 'ini', 'log']);

export type Destination = { kind: 'email' | 'site'; value: string };

/** The email addresses and sites a piece of text names (lower-cased, de-duplicated). */
export function destinations(text: string): Destination[] {
  const out = new Map<string, Destination>();
  const emails = text.match(EMAIL) ?? [];
  for (const e of emails) out.set(`email:${e.toLowerCase()}`, { kind: 'email', value: e.toLowerCase() });
  // Domains are looked for with the addresses taken out, so a mailbox's domain is not counted twice.
  const rest = emails.reduce((t, e) => t.split(e).join(' '), text);
  for (const url of rest.match(URL_RE) ?? []) addSite(out, siteKey(url));
  for (const host of rest.replace(URL_RE, ' ').match(DOMAIN) ?? []) {
    if (!FILE_ENDINGS.has(host.split('.').pop()!.toLowerCase())) addSite(out, siteKey(`https://${host}`));
  }
  return [...out.values()];
}

function addSite(out: Map<string, Destination>, site: string): void {
  if (site) out.set(`site:${site}`, { kind: 'site', value: site });
}

/**
 * The destinations in an action that neither the user's messages nor the sites in play
 * (the page acted on, the navigation target) account for.
 */
export function unexplained(found: Destination[], userText: string, sitesInPlay: string[]): Destination[] {
  const user = userText.toLowerCase();
  const userSites = new Set(destinations(userText).filter((d) => d.kind === 'site').map((d) => d.value));
  const known = new Set([...sitesInPlay.filter(Boolean), ...userSites]);
  return found.filter((d) => {
    if (d.kind === 'email') return !user.includes(d.value);
    return !known.has(d.value) && !namedInText(d.value, user);
  });
}

/** "Wikipedia" in the user's words accounts for wikipedia.org: the site's name as a whole word. */
function namedInText(site: string, user: string): boolean {
  const name = site.split('.')[0] ?? '';
  return name.length >= 3 && new RegExp(`\\b${name.replace(/[^a-z0-9]/g, '')}\\b`).test(user);
}

type MessageClient = { message: { list(input: { sessionID: string; order?: 'asc' | 'desc'; limit?: number }): Promise<unknown> } };

/** The text of the session's user messages, newest 50 (undefined when the server cannot be asked). */
export async function userMessagesText(client: MessageClient | undefined, sessionID: string): Promise<string | undefined> {
  if (!client) return undefined;
  try {
    const page = (await client.message.list({ sessionID, order: 'desc', limit: 50 })) as { data?: unknown[] };
    return (page.data ?? [])
      .filter((m): m is { type: string; text?: unknown } => typeof m === 'object' && m !== null && (m as { type?: unknown }).type === 'user')
      .map((m) => (typeof m.text === 'string' ? m.text : ''))
      .join('\n');
  } catch {
    return undefined;
  }
}
