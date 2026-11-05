// The opencode server only issues client-MCP tickets (and accepts the socket) when the request
// has no Origin header, comes from loopback/opencode.ai, or comes from an origin on its CORS
// list. `opencode service` cannot list a chrome-extension:// origin (its CLI rejects
// non-HTTP origins and, in 2.2.5, the service ignores a `cors` value in its config file), so
// the extension removes its own Origin header on exactly those two requests. The rule matches
// only requests the extension itself makes (tabId -1) to the paired server's client-MCP path.
import { browser } from 'wxt/browser';

const RULE_ID = 4711;

/** The session rule for a server base URL: drop `Origin` on its client-MCP token and socket requests. */
export function originRule(baseUrl: string) {
  const url = new URL(baseUrl);
  const base = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return {
    id: RULE_ID,
    priority: 1,
    action: { type: 'modifyHeaders' as const, requestHeaders: [{ header: 'origin', operation: 'remove' as const }] },
    condition: {
      urlFilter: `|${url.protocol}//${url.host}${base}api/experimental/client-mcp`,
      tabIds: [-1],
      resourceTypes: ['xmlhttprequest' as const, 'websocket' as const, 'other' as const],
    },
  };
}

/** Installs (or moves) the rule for the current server. Never throws: without it, a server with the origin listed still works. */
export async function allowClientMcpFrom(baseUrl: string): Promise<void> {
  const dnr = browser.declarativeNetRequest;
  if (!dnr?.updateSessionRules) return;
  await dnr.updateSessionRules({ removeRuleIds: [RULE_ID], addRules: [originRule(baseUrl)] }).catch((error: unknown) => {
    console.warn('[browser] could not install the client-MCP origin rule', error);
  });
}
