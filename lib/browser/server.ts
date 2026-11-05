// The opencode server, as seen from the browser agent: a client for the stored pairing,
// plus the model capability lookup the screenshot tools need (spec browser/screenshots).
import { createClient, type OpenCodeClient } from '../opencode/client';
import { loadConnection, type Connection } from '../opencode/connection';

export type ServerAccess = () => Promise<OpenCodeClient | undefined>;

/** A client for the current pairing, rebuilt when the pairing changes. */
export function serverAccess(load: () => Promise<Connection | null> = loadConnection, fetchFn?: typeof fetch): ServerAccess {
  let cached: { key: string; client: OpenCodeClient } | undefined;
  return async () => {
    const connection = await load();
    if (!connection) return undefined;
    const key = `${connection.baseUrl}|${connection.token}`;
    if (cached?.key !== key) cached = { key, client: createClient({ baseUrl: connection.baseUrl, token: connection.token, fetch: fetchFn }) };
    return cached.client;
  };
}

const CACHE_MS = 60_000;

/**
 * Whether the session's current model accepts images. `undefined` when it cannot be told
 * (the server is unreachable): callers then allow the screenshot rather than block it.
 */
export class VisionCheck {
  private readonly cache = new Map<string, { at: number; value: boolean | undefined; model?: string }>();

  constructor(
    private readonly server: ServerAccess,
    private readonly now: () => number = Date.now,
  ) {}

  async supports(sessionID: string): Promise<{ vision: boolean | undefined; model?: string }> {
    const hit = this.cache.get(sessionID);
    if (hit && this.now() - hit.at < CACHE_MS) return { vision: hit.value, model: hit.model };
    let value: boolean | undefined;
    let model: string | undefined;
    try {
      const client = await this.server();
      if (client) {
        const session = (await client.session.get({ sessionID })) as unknown as { model?: { providerID: string; id: string } };
        if (session.model) {
          model = `${session.model.providerID}/${session.model.id}`;
          const list = (await client.model.list()) as unknown as { data: Array<{ providerID: string; id: string; capabilities?: { input?: string[] } }> };
          const info = list.data.find((m) => m.providerID === session.model!.providerID && m.id === session.model!.id);
          if (info?.capabilities?.input) value = info.capabilities.input.includes('image');
        }
      }
    } catch {
      value = undefined;
    }
    this.cache.set(sessionID, { at: this.now(), value, model });
    return { vision: value, model };
  }
}
