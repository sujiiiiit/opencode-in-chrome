// The viewport window and the character budget for read_page (spec browser/page-observation,
// design D5), after Nanobrowser's perception/window.ts. Boxes are in top-viewport CSS px. By
// default the outline covers the viewport plus one viewport height above and below; lines
// farthest from the viewport are cut first when over budget; every omission is stated.
import type { LineBox } from './walker';

export type WindowMode = 'viewport' | 'near' | 'page';

/** A rendered outline line and its element's box in top-viewport coordinates. */
export type OutlineLine = { text: string; box: LineBox };

const REF = /\[e\d+\]/;
const depthOf = (text: string) => text.length - text.trimStart().length;

/** Each line's box, or its nearest ancestor's when it has none (null when no ancestor has one either). */
function effectiveBoxes(lines: OutlineLine[]): LineBox[] {
  const stack: Array<{ depth: number; box: LineBox }> = [];
  return lines.map((line) => {
    const depth = depthOf(line.text);
    while (stack.length && stack.at(-1)!.depth >= depth) stack.pop();
    const box = line.box ?? [...stack].reverse().find((s) => s.box)?.box ?? null;
    stack.push({ depth, box });
    return box;
  });
}

/** Where a box sits against a span: -1 above, 1 below, 0 overlapping (or unknown). */
function side(box: LineBox, lo: number, hi: number): -1 | 0 | 1 {
  if (!box) return 0;
  if (box[0] + box[1] < lo) return -1;
  if (box[0] > hi) return 1;
  return 0;
}

function distance(box: LineBox, height: number): number {
  if (!box) return 0;
  if (box[0] + box[1] < 0) return -(box[0] + box[1]);
  if (box[0] > height) return box[0] - height;
  return 0;
}

/** Adds every kept line's ancestors, so the printed tree stays readable. */
function withAncestors(lines: OutlineLine[], keep: boolean[]): boolean[] {
  const out = [...keep];
  const stack: number[] = [];
  lines.forEach((line, i) => {
    const depth = depthOf(line.text);
    while (stack.length && depthOf(lines[stack.at(-1)!]!.text) >= depth) stack.pop();
    if (keep[i]) for (const a of stack) out[a] = true;
    stack.push(i);
  });
  return out;
}

export type Windowed = { lines: string[]; notes: string[] };

export function applyWindow(lines: OutlineLine[], viewportHeight: number, mode: WindowMode, maxChars: number): Windowed {
  const boxes = effectiveBoxes(lines);
  const notes: string[] = [];
  let keep = lines.map(() => true);
  if (mode !== 'page' && viewportHeight > 0) {
    const [lo, hi] = mode === 'near' ? [-viewportHeight, 2 * viewportHeight] : [0, viewportHeight];
    const inside = boxes.map((box) => side(box, lo, hi) === 0);
    keep = withAncestors(lines, inside);
    let above = 0;
    let below = 0;
    lines.forEach((line, i) => {
      if (keep[i] || !REF.test(line.text)) return;
      if (side(boxes[i]!, lo, hi) < 0) above++;
      else below++;
    });
    const where = mode === 'near' ? 'the window (the viewport and one screen above and below)' : 'the viewport';
    if (above || below) {
      notes.push(`… ${above} more actionable element${above === 1 ? '' : 's'} above and ${below} below ${where}. Scroll, use find, or read_page with window: "page" to see them.`);
    }
  }
  const cut = cutToBudget(lines, boxes, keep, viewportHeight, maxChars);
  if (cut.lines) {
    notes.push(
      `… cut to ${maxChars} characters, farthest from the viewport first: ${cut.lines} more lines not shown (${cut.above} actionable above, ${cut.below} below). Use ref_id, find, or a smaller window.`,
    );
  }
  return { lines: lines.filter((_, i) => cut.keep[i]).map((l) => l.text), notes };
}

/** Drops kept lines farthest from the viewport until the text fits. */
function cutToBudget(lines: OutlineLine[], boxes: LineBox[], keep: boolean[], height: number, maxChars: number) {
  const out = [...keep];
  let size = lines.reduce((n, l, i) => n + (out[i] ? l.text.length + 1 : 0), 0);
  const result = { keep: out, lines: 0, above: 0, below: 0 };
  if (size <= maxChars) return result;
  const order = lines
    .map((_, i) => i)
    .filter((i) => out[i])
    // Farthest first; on a tie, later lines first so the top of the page survives.
    .sort((a, b) => distance(boxes[b]!, height) - distance(boxes[a]!, height) || b - a);
  for (const i of order) {
    if (size <= maxChars) break;
    out[i] = false;
    size -= lines[i]!.text.length + 1;
    result.lines++;
    if (REF.test(lines[i]!.text)) {
      if (side(boxes[i]!, 0, height) < 0) result.above++;
      else result.below++;
    }
  }
  return result;
}
