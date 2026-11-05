// Parses what the user pastes from `opencode pair` into { baseUrl, code }.
// Slice 1 only accepts loopback servers (host access to every site exists for the
// browser agent's page scripting, not for talking to remote opencode servers).

export type ParsedPairing =
  | { ok: true; baseUrl: string; code: string }
  | { ok: false; error: string };

const CODE_RE = /^[A-Za-z0-9_-]{16,64}$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);
const CONNECT_PREFIX = '/auth/connect/';

const NON_LOOPBACK_MESSAGE =
  'Only a local opencode server (127.0.0.1 or localhost) is supported for now.';

function stripWrapping(input: string): string {
  return input.trim().replace(/^["'`<]+|["'`>]+$/g, '').trim();
}

/** Returns the normalised origin, or an error message. */
export function normalizeBaseUrl(raw: string): { ok: true; baseUrl: string } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(stripWrapping(raw));
  } catch {
    return { ok: false, error: 'That is not a valid server address.' };
  }
  if (url.protocol !== 'http:') return { ok: false, error: NON_LOOPBACK_MESSAGE };
  if (url.username || url.password) return { ok: false, error: 'The address must not contain credentials.' };
  if (!LOOPBACK_HOSTS.has(url.hostname)) return { ok: false, error: NON_LOOPBACK_MESSAGE };
  return { ok: true, baseUrl: url.origin };
}

function linkProblem(url: URL): string | null {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'The pairing link must start with http://.';
  if (url.username || url.password) return 'The pairing link must not contain credentials.';
  if (url.search || url.hash) return 'The pairing link must not contain a query or fragment.';
  if (!url.pathname.startsWith(CONNECT_PREFIX)) {
    return 'That is not a pairing link. It should end in /auth/connect/<code>.';
  }
  return null;
}

function fromLink(text: string): ParsedPairing {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: 'That is not a valid pairing link.' };
  }
  const problem = linkProblem(url);
  if (problem) return { ok: false, error: problem };
  const code = url.pathname.slice(CONNECT_PREFIX.length);
  if (!CODE_RE.test(code)) return { ok: false, error: 'The pairing code looks invalid.' };
  const base = normalizeBaseUrl(url.origin);
  if (!base.ok) return base;
  return { ok: true, baseUrl: base.baseUrl, code };
}

export function parsePairingInput(input: string, fallbackBaseUrl?: string): ParsedPairing {
  const text = stripWrapping(input);
  if (!text) return { ok: false, error: 'Paste the link printed by `opencode pair`.' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return fromLink(text);

  if (!CODE_RE.test(text)) return { ok: false, error: 'The pairing code looks invalid.' };
  if (!fallbackBaseUrl?.trim()) return { ok: false, error: 'Enter the server address, or paste the full link.' };
  const base = normalizeBaseUrl(fallbackBaseUrl);
  if (!base.ok) return base;
  return { ok: true, baseUrl: base.baseUrl, code: text };
}
