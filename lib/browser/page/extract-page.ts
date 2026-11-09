// The page side of `extract` (P9 in docs/browser-automation-coverage.md): turns a table, a
// list, or a grid of repeated cards into rows of named fields, so the model gets data in a
// few hundred tokens instead of reading the whole page tree.

export type Extracted = { kind: 'table' | 'list'; source: string; columns: string[]; rows: string[][]; total: number };

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function visible(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: () => boolean }).checkVisibility;
  return typeof check === 'function' ? check.call(el) : true;
}

function describe(el: Element): string {
  const id = el.id ? `#${el.id}` : '';
  const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '';
  const label = el.getAttribute('aria-label') ?? el.querySelector('caption')?.textContent;
  return `${el.tagName.toLowerCase()}${id}${cls}${label ? ` "${clean(label).slice(0, 60)}"` : ''}`;
}

// ─── Tables ──────────────────────────────────────────────────────────────

function cellsOf(row: Element): Element[] {
  return Array.from(row.children).filter((c) => /^(TD|TH)$/.test(c.tagName) || ['cell', 'gridcell', 'columnheader', 'rowheader'].includes(c.getAttribute('role') ?? ''));
}

function cellText(cell: Element): string {
  const text = clean((cell as HTMLElement).innerText ?? cell.textContent);
  if (text) return text;
  const control = cell.querySelector('input, select, textarea') as HTMLInputElement | null;
  return control ? clean(control.value) : clean(cell.querySelector('img')?.getAttribute('alt'));
}

function tableRows(table: Element): Element[] {
  const rows = Array.from(table.querySelectorAll('tr, [role="row"]'));
  // Rows of a nested table belong to that table.
  return rows.filter((r) => r.closest('table, [role="table"], [role="grid"], [role="treegrid"]') === table);
}

function extractTable(table: Element, max: number): Extracted {
  const rows = tableRows(table).filter(visible);
  const headerRow = rows.find((r) => cellsOf(r).length && cellsOf(r).every((c) => c.tagName === 'TH' || c.getAttribute('role') === 'columnheader'));
  const body = rows.filter((r) => r !== headerRow && cellsOf(r).length);
  const width = Math.max(headerRow ? cellsOf(headerRow).length : 0, ...body.map((r) => cellsOf(r).length));
  const columns = headerRow ? cellsOf(headerRow).map(cellText) : [];
  for (let i = columns.length; i < width; i++) columns.push(`col${i + 1}`);
  return {
    kind: 'table',
    source: describe(table),
    columns: columns.map((c, i) => c || `col${i + 1}`),
    rows: body.slice(0, max).map((r) => cellsOf(r).map(cellText)),
    total: body.length,
  };
}

// ─── Lists and card grids ────────────────────────────────────────────────

const signature = (el: Element) => `${el.tagName}|${typeof el.className === 'string' ? el.className.trim().split(/\s+/).sort().join(' ') : ''}`;

/** The children of `parent` that repeat (same tag and classes), if there are at least 2. */
function repeatedChildren(parent: Element): Element[] {
  const groups = new Map<string, Element[]>();
  for (const child of Array.from(parent.children)) {
    if (!visible(child) || !clean(child.textContent)) continue;
    const key = signature(child);
    groups.set(key, [...(groups.get(key) ?? []), child]);
  }
  let best: Element[] = [];
  for (const group of groups.values()) if (group.length > best.length) best = group;
  return best.length >= 2 ? best : [];
}

/** The best repeated group under `root`: most items, ties to the one with more text per item. */
function bestGroup(root: Element): Element[] {
  let best: Element[] = [];
  let score = 0;
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const group = repeatedChildren(el);
    if (!group.length) continue;
    // More items wins, weighted by how many fields an item has (capped, so one rich card cannot beat a list).
    const s = group.length * Math.min(3, fieldsOf(group[0]!).length || 1);
    if (s > score) {
      best = group;
      score = s;
    }
  }
  return best;
}

/** The repeated group that `el` (or one of its ancestors) is an item of: a ref on a button inside a card. */
function groupContaining(el: Element): Element[] {
  for (let item: Element | null = el; item?.parentElement; item = item.parentElement) {
    const group = repeatedChildren(item.parentElement);
    if (group.includes(item)) return group;
  }
  return [];
}

type Field = { key: string; value: string };

function keyOf(el: Element, fallback: string): string {
  const named = el.getAttribute('itemprop') ?? el.getAttribute('data-field') ?? el.getAttribute('aria-label');
  if (named) return clean(named).slice(0, 30);
  const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
  return cls || fallback;
}

/** An item's fields: each element with its own text, plus link targets and image alts. */
function fieldsOf(item: Element): Field[] {
  const out: Field[] = [];
  const walker = item.ownerDocument.createTreeWalker(item, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.currentNode as Element | null; node; node = walker.nextNode() as Element | null) {
    if (!visible(node)) continue;
    const own = clean(Array.from(node.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '));
    if (own) out.push({ key: keyOf(node, node.tagName.toLowerCase()), value: own });
    if (node.tagName === 'A' && node.getAttribute('href')) out.push({ key: 'link', value: (node as HTMLAnchorElement).href });
    if (node.tagName === 'IMG' && node.getAttribute('alt')) out.push({ key: 'image', value: clean(node.getAttribute('alt')) });
  }
  return out;
}

function extractList(container: Element, items: Element[], max: number): Extracted {
  const perItem = items.map(fieldsOf);
  // Column order: first seen across items; a key repeated inside an item gets a number.
  const columns: string[] = [];
  const keyed = perItem.map((fields) => {
    const seen = new Map<string, number>();
    const row = new Map<string, string>();
    for (const f of fields) {
      const n = (seen.get(f.key) ?? 0) + 1;
      seen.set(f.key, n);
      const key = n === 1 ? f.key : `${f.key}${n}`;
      if (!columns.includes(key)) columns.push(key);
      row.set(key, f.value);
    }
    return row;
  });
  // A column filled in fewer than a fifth of items is noise (badges, one-off labels).
  const kept = columns.filter((c) => keyed.filter((r) => r.has(c)).length * 5 >= items.length);
  return {
    kind: 'list',
    source: describe(container),
    columns: kept,
    rows: keyed.slice(0, max).map((r) => kept.map((c) => r.get(c) ?? '')),
    total: items.length,
  };
}

const TABLE = 'table, [role="table"], [role="grid"], [role="treegrid"]';

/** Extracts from `root` (an element the model pointed at, or the page's main content). */
export function extract(root: Element, max: number): Extracted | { error: 'INVALID_INPUT'; message: string } {
  const table = root.matches(TABLE) ? root : (root.closest(TABLE) ?? largestTable(root));
  if (table) return extractTable(table, max);
  const inside = bestGroup(root);
  const items = inside.length ? inside : groupContaining(root);
  if (items.length) return extractList(items[0]!.parentElement ?? root, items, max);
  return { error: 'INVALID_INPUT', message: `No table, list or repeated items found in ${describe(root)}. Point ref at the element that holds the items.` };
}

function largestTable(root: Element): Element | undefined {
  let best: Element | undefined;
  let rows = 1;
  for (const t of Array.from(root.querySelectorAll(TABLE))) {
    const n = tableRows(t).length;
    if (n > rows && visible(t)) {
      best = t;
      rows = n;
    }
  }
  return best;
}

/** Where to look without a ref: the page's main region, else the body. */
export function defaultRoot(doc: Document): Element {
  return doc.querySelector('main, [role="main"]') ?? doc.body;
}
