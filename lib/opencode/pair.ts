import { createClient, isTransportError, isUnauthorized, OFFLINE_MESSAGE } from './client';
import { isValidToken, saveConnection, tokenExpiry, type Connection } from './connection';
import { ensureWorkspace } from './workspace';

export type PairFailureKind = 'expired' | 'offline' | 'invalid' | 'unauthorized';
export type PairResult =
  | { ok: true; connection: Connection }
  | { ok: false; kind: PairFailureKind; message: string };

const fail = (kind: PairFailureKind, message: string): PairResult => ({ ok: false, kind, message });

const EXPIRED_MESSAGE = 'Link expired or used. Run `opencode pair` again and click the new link.';

type Options = { baseUrl: string; fetch?: typeof globalThis.fetch; now?: () => number };
export type PairOptions = Options & { code: string };
export type TokenOptions = Options & { token: string };

/**
 * Redeems a one-time pairing code (JSON flow, redirects refused), verifies the
 * token against /api/info, stores the connection and bootstraps the workspace.
 */
export async function pairWithCode({ baseUrl, code, fetch, now }: PairOptions): Promise<PairResult> {
  const anonymous = createClient({ baseUrl, fetch });
  let token: unknown;
  try {
    const session = await anonymous.server.connect({ code }, { headers: { accept: 'application/json' } });
    token = (session as { token?: unknown } | null)?.token;
  } catch (error) {
    if (isUnauthorized(error)) return fail('expired', EXPIRED_MESSAGE);
    if (isTransportError(error)) return fail('offline', OFFLINE_MESSAGE);
    return fail('invalid', 'No opencode server at this address.');
  }
  if (!isValidToken(token)) return fail('invalid', 'No opencode server at this address.');
  return connectWithToken({ baseUrl, token, fetch, now });
}

/**
 * Verifies a token (from a redeemed code or the browser's opencode session)
 * against /api/info, stores the connection and bootstraps the workspace.
 */
export async function connectWithToken({ baseUrl, token, fetch, now = Date.now }: TokenOptions): Promise<PairResult> {
  if (!isValidToken(token)) return fail('invalid', 'No opencode server at this address.');
  const client = createClient({ baseUrl, token, fetch });
  let version: unknown;
  try {
    version = (await client.server.info()).version;
  } catch (error) {
    if (isUnauthorized(error)) return fail('unauthorized', 'The server rejected the new token. Try pairing again.');
    if (isTransportError(error)) return fail('offline', OFFLINE_MESSAGE);
    return fail('invalid', 'No opencode server at this address.');
  }
  if (typeof version !== 'string') return fail('invalid', 'No opencode server at this address.');

  const connection: Connection = {
    baseUrl,
    token,
    expiresAt: tokenExpiry(token),
    serverVersion: version,
    pairedAt: now(),
  };
  await saveConnection(connection);
  // Pairing succeeded even if this fails; chat retries the bootstrap.
  await ensureWorkspace(client, baseUrl).catch(() => undefined);
  return { ok: true, connection };
}

const DETECT_PORTS = [28894, 49374];
const DETECT_TIMEOUT_MS = 1000;

/** Finds a local opencode server: an unauthenticated /api/info answers 401 UnauthorizedError. */
export async function detectServer(fetch: typeof globalThis.fetch = globalThis.fetch): Promise<string | null> {
  const probes = DETECT_PORTS.map(async (port) => {
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
      const response = await fetch(`${baseUrl}/api/info`, {
        redirect: 'error',
        signal: AbortSignal.timeout(DETECT_TIMEOUT_MS),
      });
      if (response.status !== 401) return null;
      const body: unknown = await response.json();
      const tag = typeof body === 'object' && body !== null ? (body as { _tag?: unknown })._tag : undefined;
      return tag === 'UnauthorizedError' ? baseUrl : null;
    } catch {
      return null;
    }
  });
  return (await Promise.all(probes)).find((url) => url !== null) ?? null;
}
