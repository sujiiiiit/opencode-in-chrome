import { OpenCode } from '@opencode/client';
import { authHeader } from './connection';

/** The @opencode/client version this build is pinned to (compared with /api/info). */
export const PINNED_SERVER_VERSION = '2.2.5';
const REQUEST_TIMEOUT_MS = 15_000;

export const OFFLINE_MESSAGE = "opencode isn't running. Run `opencode service start` and try again.";
export const NO_MODEL_MESSAGE = 'No model configured. Run `opencode` and set up a provider.';

export type OpenCodeClient = ReturnType<typeof OpenCode.make>;
type FetchFn = typeof globalThis.fetch;

/**
 * Wraps fetch for all non-streaming calls: never follow redirects (the pairing
 * endpoint redirects the HTML flow, which would burn the code) and always apply
 * a timeout. The caller's own abort signal still works.
 */
function guardedFetch(inner?: FetchFn): FetchFn {
  return (input, init) => {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const run = inner ?? globalThis.fetch;
    return run(input, { ...init, redirect: 'error', signal });
  };
}

export function createClient(options: { baseUrl: string; token?: string; fetch?: FetchFn }): OpenCodeClient {
  return OpenCode.make({
    baseUrl: options.baseUrl,
    fetch: guardedFetch(options.fetch),
    headers: options.token ? { authorization: authHeader(options.token) } : undefined,
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** A declared error is thrown as its parsed body `{_tag, message}`; an undeclared one as an UnexpectedStatus. */
function isHttpError(error: unknown, tag: string, status: number): boolean {
  const e = asRecord(error);
  if (!e) return false;
  if (e._tag === tag || e.status === status) return true;
  const cause = asRecord(e.cause);
  return e.reason === 'UnexpectedStatus' && cause?.status === status;
}

export const isUnauthorized = (error: unknown) => isHttpError(error, 'UnauthorizedError', 401);

/** The session was deleted (from another client, or before this panel reopened it). */
export const isSessionNotFound = (error: unknown) => isHttpError(error, 'SessionNotFoundError', 404);

/** The server no longer keeps that shell (it drops exited shells past its retention limit). */
/** The form was already answered or cancelled, or no longer exists. */
export const isFormGone = (error: unknown) =>
  isHttpError(error, 'FormNotFoundError', 404) || isHttpError(error, 'FormAlreadySettledError', 409);

export const isShellNotFound = (error: unknown) => isHttpError(error, 'ShellNotFoundError', 404);

export function isTransportError(error: unknown): boolean {
  const e = asRecord(error);
  if (e?.name === 'ClientError' && e.reason === 'Transport') return true;
  return error instanceof TypeError;
}

/** A user-facing plain-text description of anything thrown by the client. */
export function describeError(error: unknown): string {
  const e = asRecord(error);
  if (e?._tag === 'ModelNotSelectedError') return NO_MODEL_MESSAGE;
  if (isTransportError(error)) return OFFLINE_MESSAGE;
  if (e?.name === 'TimeoutError') return 'The opencode server did not answer in time.';
  if (typeof e?.message === 'string' && e.message) return e.message;
  return 'Something went wrong talking to opencode.';
}
