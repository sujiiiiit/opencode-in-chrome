// extract (P9 in docs/browser-automation-coverage.md): a table, list or card grid as CSV or
// JSON rows. Far smaller than read_page or get_page_text for "collect these items" tasks.
import type { Extracted } from '../page/extract-page';
import type { PageError } from '../page/actions-page';
import { staleRef, type PageReader } from '../snapshot/reader';
import type { TabScope } from '../tabs';
import { ToolError, untrusted, type ToolDef } from './registry';
import { requirePage, tabIdProperty } from './tabs';

const DEFAULT_ROWS = 100;
const DEFAULT_CHARS = 20_000;

const isError = (v: unknown): v is PageError => typeof v === 'object' && v !== null && 'error' in v;

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Rows as CSV (header first) or as JSON objects keyed by column. */
export function formatRows(data: Pick<Extracted, 'columns' | 'rows'>, format: 'csv' | 'json'): string {
  if (format === 'json') return JSON.stringify(data.rows.map((r) => Object.fromEntries(data.columns.map((c, i) => [c, r[i] ?? '']))));
  return [data.columns, ...data.rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

export function extractTool(scope: TabScope, reader: PageReader): ToolDef {
  return {
    name: 'extract',
    description:
      'Get the rows of a table, list or grid of repeated items (products, results, emails) as CSV (default) or JSON, ' +
      'with named columns. Give the ref of the table/list (or any element inside it); without a ref, the largest table or ' +
      'repeated list in the main content is used. Much smaller than read_page for collecting data.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: tabIdProperty,
        ref: { type: 'string', description: 'The table, list or container to read, e.g. e14.' },
        format: { type: 'string', enum: ['csv', 'json'], description: 'csv (default, smallest) or json.' },
        max_rows: { type: 'integer', minimum: 1, maximum: 1000, description: `Rows to return (default ${DEFAULT_ROWS}).` },
        max_chars: { type: 'integer', minimum: 500, description: `Output cap (default ${DEFAULT_CHARS}).` },
      },
    },
    async handler(args, { sessionID }) {
      const tab = await requirePage(scope, sessionID, args.tabId);
      const max = typeof args.max_rows === 'number' ? args.max_rows : DEFAULT_ROWS;
      const result = await readRows(reader, tab.id, typeof args.ref === 'string' ? args.ref : undefined, max);
      const body = formatRows(result, args.format === 'json' ? 'json' : 'csv');
      const cap = typeof args.max_chars === 'number' ? args.max_chars : DEFAULT_CHARS;
      const shown = Math.min(result.rows.length, result.total);
      const head = `${result.kind === 'table' ? 'Table' : 'List'} ${result.source}: ${result.total} row(s)${shown < result.total ? `, showing ${shown}` : ''}.`;
      const text = body.length > cap ? `${body.slice(0, cap)}\n[cut at ${cap} characters; ask for fewer rows or raise max_chars]` : body;
      return { text: [head, untrusted(text)], tabId: tab.id };
    },
  };
}

async function readRows(reader: PageReader, tabId: number, ref: string | undefined, max: number): Promise<Extracted> {
  let result: Extracted | PageError | undefined;
  if (ref) {
    const target = reader.refs.lookup(tabId, ref);
    if (!target) throw staleRef(ref);
    result = await reader.call<Extracted | PageError>(tabId, target.documentId, 'extract', [target.n, max]);
  } else {
    result = await reader.callTop<Extracted | PageError>(tabId, 'extract', [null, max]);
  }
  if (!result) throw new ToolError('RESTRICTED_PAGE', 'The page cannot be read (it may still be loading).');
  if (isError(result)) {
    if (result.error === 'STALE_REF' && ref) throw staleRef(ref);
    throw new ToolError(result.error, result.message);
  }
  return result;
}
