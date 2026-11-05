import { describe, expect, it } from 'vitest';
import { applyWindow, type OutlineLine } from '@/lib/browser/snapshot/window';

// A 10-viewport page (viewport 800 px): one button every 400 px, inside a main landmark.
const VIEW = 800;
const tall = (): OutlineLine[] => [
  { text: 'main', box: [0, 8000] },
  ...Array.from({ length: 20 }, (_, i) => ({ text: ` button "B${i}" [e${i + 1}]`, box: [i * 400, 30] as [number, number] })),
];

describe('applyWindow', () => {
  it('near: the viewport and one screen above and below, with the counts of what is outside', () => {
    const { lines, notes } = applyWindow(tall(), VIEW, 'near', 30_000);
    // Top of the page: [-800, 1600] holds buttons at 0, 400, ..., 1600.
    expect(lines).toEqual(['main', ...[0, 1, 2, 3, 4].map((i) => ` button "B${i}" [e${i + 1}]`)]);
    expect(notes).toEqual(['… 0 more actionable elements above and 15 below the window (the viewport and one screen above and below). Scroll, use find, or read_page with window: "page" to see them.']);
  });

  it('follows the scroll position: boxes are viewport-relative', () => {
    const scrolled = tall().map((l) => ({ ...l, box: l.box ? ([l.box[0] - 4000, l.box[1]] as [number, number]) : null }));
    const { lines, notes } = applyWindow(scrolled, VIEW, 'viewport', 30_000);
    expect(lines).toEqual(['main', ' button "B10" [e11]', ' button "B11" [e12]', ' button "B12" [e13]']);
    expect(notes[0]).toMatch(/^… 10 more actionable elements above and 7 below the viewport\./);
  });

  it('page: everything, and no window note', () => {
    const { lines, notes } = applyWindow(tall(), VIEW, 'page', 30_000);
    expect(lines).toHaveLength(21);
    expect(notes).toEqual([]);
  });

  it('over budget: cuts the lines farthest from the viewport first and says how many above and below', () => {
    const scrolled = tall().map((l) => ({ ...l, box: l.box ? ([l.box[0] - 4000, l.box[1]] as [number, number]) : null }));
    const { lines, notes } = applyWindow(scrolled, VIEW, 'page', 120);
    // The buttons nearest the viewport (B10..B12) survive; the ends of the page go first.
    expect(lines).toContain(' button "B10" [e11]');
    expect(lines).not.toContain(' button "B0" [e1]');
    expect(lines).not.toContain(' button "B19" [e20]');
    expect(lines.join('\n').length).toBeLessThanOrEqual(120);
    expect(notes[0]).toMatch(/^… cut to 120 characters, farthest from the viewport first: \d+ more lines not shown \(\d+ actionable above, \d+ below\)/);
  });

  it('keeps the ancestors of kept lines, and lines without a box take their parent box', () => {
    const lines: OutlineLine[] = [
      { text: 'navigation "Footer"', box: [5000, 100] },
      { text: ' link "About" [e1]', box: null },
      { text: 'form "Search"', box: [0, 200] },
      { text: ' textbox "Query" [e2]', box: [10, 20] },
      { text: '  option "x"', box: null },
    ];
    const out = applyWindow(lines, VIEW, 'near', 30_000);
    expect(out.lines).toEqual(['form "Search"', ' textbox "Query" [e2]', '  option "x"']);
    expect(out.notes[0]).toMatch(/0 more actionable elements above and 1 below/);
  });
});
