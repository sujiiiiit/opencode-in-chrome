// Outline diffs (spec browser/page-observation, design D4), after Nanobrowser's
// perception/diff.ts: refs are stable within a document, so the page after an action can be
// shown as the lines that changed since the outline the session last saw.

export type DiffOp = { op: 'keep' | 'add' | 'remove'; line: string };

const MAX_LINES = 4_000;
export const MAX_CHANGED = 60;

/** A line-level edit script by longest common subsequence; null when either side is too long. */
export function diffLines(prev: string[], next: string[]): DiffOp[] | null {
  if (prev.length > MAX_LINES || next.length > MAX_LINES) return null;
  // Trim the common head and tail first: most diffs are small changes in a long outline.
  let head = 0;
  while (head < prev.length && head < next.length && prev[head] === next[head]) head++;
  let tail = 0;
  while (tail < prev.length - head && tail < next.length - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail++;
  const a = prev.slice(head, prev.length - tail);
  const b = next.slice(head, next.length - tail);
  const n = a.length;
  const m = b.length;
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  }
  const ops: DiffOp[] = prev.slice(0, head).map((line) => ({ op: 'keep', line }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ op: 'keep', line: a[i++]! });
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) ops.push({ op: 'remove', line: a[i++]! });
    else ops.push({ op: 'add', line: b[j++]! });
  }
  while (i < n) ops.push({ op: 'remove', line: a[i++]! });
  while (j < m) ops.push({ op: 'add', line: b[j++]! });
  ops.push(...prev.slice(prev.length - tail).map((line) => ({ op: 'keep' as const, line })));
  return ops;
}

/**
 * The changed lines (`+` added, `-` removed) with each run of unchanged lines collapsed to a
 * count, capped at `max` changed lines. Empty when nothing changed.
 */
export function formatDiff(ops: DiffOp[], max = MAX_CHANGED): string[] {
  const changed = ops.filter((o) => o.op !== 'keep').length;
  if (!changed) return [];
  const out: string[] = [];
  let shown = 0;
  let unchanged = 0;
  const flush = () => {
    if (unchanged) out.push(`  … ${unchanged} unchanged`);
    unchanged = 0;
  };
  for (const o of ops) {
    if (o.op === 'keep') {
      unchanged++;
      continue;
    }
    if (shown === max) break;
    flush();
    out.push(`${o.op === 'add' ? '+' : '-'} ${o.line}`);
    shown++;
  }
  if (changed > shown) out.push(`… ${changed - shown} more changed lines not shown. Read the page for the rest.`);
  return out;
}
