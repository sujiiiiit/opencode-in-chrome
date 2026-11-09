// navigate and resize_window (spec browser/page-actions).
import type { Dialogs } from '../dialogs';
import { DOM_QUIET_MS, navigateAndWait, navigationText, type NavEvents } from '../navigation';
import type { PageReader } from '../snapshot/reader';
import type { Tab, TabScope } from '../tabs';
import { botCheckNote } from '../bot-check';
import { ToolError, type ToolDef } from './registry';
import { tabIdProperty, withScheme } from './tabs';
import type { ComputerDeps } from './computer';

export type NavigateDeps = {
  scope: TabScope;
  reader: PageReader;
  dialogs: Dialogs;
  events: NavEvents;
  tabs: {
    get(tabId: number): Promise<Tab>;
    update(tabId: number, url: string): Promise<void>;
    back(tabId: number): Promise<void>;
    forward(tabId: number): Promise<void>;
    reload(tabId: number): Promise<void>;
    resizeWindowOf(tabId: number, width: number, height: number): Promise<void>;
  };
  guard?: ComputerDeps['guard'];
};

export function navigateTools(deps: NavigateDeps): ToolDef[] {
  const { scope, reader, dialogs } = deps;
  return [
    {
      name: 'navigate',
      description:
        'Open a URL in the current tab (https:// assumed), or go "back" / "forward" in history, or "reload" the page. Waits for the page to load and settle (max 15 s) ' +
        'and returns its URL and title; snapshot: true also returns the interactive page tree. Creates a tab when the session has none.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL, or "back" / "forward" / "reload".' },
          tabId: tabIdProperty,
          snapshot: { type: 'boolean', description: 'Also return read_page output for the loaded page.' },
        },
        required: ['url'],
      },
      async handler(args, { sessionID }) {
        const { history, url } = navigationTarget(args.url);
        const tab = await resolveTab(scope, sessionID, args.tabId as number | undefined, !!history);
        dialogs.assertClear(tab.id);
        await deps.guard?.({ sessionID, tabId: tab.id, tool: 'navigate', action: history ?? 'open', summary: guardSummary(url, history), target: { url } });
        const id = tab.id;
        const result = await navigateAndWait({
          tabId: id,
          url,
          events: deps.events,
          start: () => startNavigation(deps, id, history, url),
          settle: async (budget) => {
            if (dialogs.get(id)) return;
            await reader.callTop(id, 'settle', [DOM_QUIET_MS, budget]).catch(() => undefined);
          },
        });
        return { text: await navigationOutput(deps, args, id, result, url, sessionID), tabId: id };
      },
    },
    {
      name: 'resize_window',
      description: "Resize the browser window holding the session's tab (for responsive layouts), then report the page's viewport size.",
      inputSchema: {
        type: 'object',
        properties: {
          tabId: tabIdProperty,
          width: { type: 'integer', minimum: 200, maximum: 7680 },
          height: { type: 'integer', minimum: 200, maximum: 4320 },
        },
        required: ['width', 'height'],
      },
      async handler(args, { sessionID }) {
        const tab = await scope.resolve(sessionID, args.tabId as number | undefined);
        await deps.tabs.resizeWindowOf(tab.id, args.width as number, args.height as number);
        await new Promise((r) => setTimeout(r, 300));
        const v = await reader.callTop<{ width: number; height: number }>(tab.id, 'viewport').catch(() => undefined);
        return {
          text: [`Resized the window to ${String(args.width)}x${String(args.height)}.${v ? ` The page viewport is now ${v.width}x${v.height}.` : ''}`],
          tabId: tab.id,
        };
      },
    },
  ];
}

type History = 'back' | 'forward' | 'reload';

const guardSummary = (url: string | undefined, history: History | undefined) => (url ? `Opens ${url}` : history === 'reload' ? 'Reloads the page' : `Goes ${history}`);

function navigationTarget(input: unknown): { history: History | undefined; url: string | undefined } {
  const raw = String(input).trim();
  if (/^(back|forward|reload)$/.test(raw)) return { history: raw as History, url: undefined };
  const url = withScheme(raw);
  if (!/^https?:/i.test(url)) throw new ToolError('INVALID_INPUT', `Only http and https pages can be opened (got ${JSON.stringify(raw)}).`);
  return { history: undefined, url };
}

const httpStatus = async (deps: NavigateDeps, tabId: number): Promise<number> => (await deps.reader.callTop<number>(tabId, 'navStatus').catch(() => 0)) || 0;
const loadedUrl = (outcome: string, url: string | undefined): boolean => outcome === 'loaded' && !!url;

/** A note when the server answered with an error status: the page shown is then an error page. */
async function httpNote(deps: NavigateDeps, tabId: number, check: boolean): Promise<string> {
  const status = check ? await httpStatus(deps, tabId) : 0;
  return status >= 400 ? `. The server answered HTTP ${status}: this is an error page, not the page you asked for.` : '';
}

async function navigationOutput(deps: NavigateDeps, args: Record<string, unknown>, tabId: number, result: Awaited<ReturnType<typeof navigateAndWait>>, url: string | undefined, sessionID: string): Promise<string[]> {
  const now = await deps.tabs.get(tabId);
  const text = [navigationText(result, { url: now.url ?? '', title: now.title ?? '' }, url)];
  text[0] += await httpNote(deps, tabId, loadedUrl(result.status, url));
  const extra = await navigationExtra(deps, args, tabId, result, sessionID);
  return [...text, ...[botCheckNote(now), extra].filter((note): note is string => Boolean(note))];
}

async function navigationExtra(deps: NavigateDeps, args: Record<string, unknown>, tabId: number, result: Awaited<ReturnType<typeof navigateAndWait>>, sessionID: string): Promise<string | undefined> {
  const dialog = deps.dialogs.get(tabId);
  if (dialog) return `Dialog open: ${dialog.type} ${JSON.stringify(dialog.message)}`;
  if (args.snapshot !== true || result.status === 'error') return undefined;
  return (await deps.reader.read(tabId, { sessionID }).catch((e: unknown) => ({ text: `(could not read the page: ${(e as Error).message})` }))).text;
}

async function resolveTab(scope: TabScope, sessionID: string, tabId: number | undefined, history: boolean) {
  try {
    return await scope.resolve(sessionID, tabId);
  } catch (error) {
    if (!canCreateTab(error, history)) throw error;
    await scope.context(sessionID, true);
    return scope.resolve(sessionID);
  }
}

function canCreateTab(error: unknown, history: boolean): boolean {
  return error instanceof ToolError && error.code === 'NO_TAB' && !history;
}

function startNavigation(deps: NavigateDeps, tabId: number, history: string | undefined, url: string | undefined): Promise<void> {
  if (history === 'back') return deps.tabs.back(tabId);
  if (history === 'forward') return deps.tabs.forward(tabId);
  if (history === 'reload') return deps.tabs.reload(tabId);
  return deps.tabs.update(tabId, url!);
}
