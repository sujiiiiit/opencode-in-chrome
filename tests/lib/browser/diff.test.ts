import { beforeEach, describe, expect, it } from 'vitest';
import { diffLines, formatDiff } from '@/lib/browser/snapshot/diff';
import { PageReader } from '@/lib/browser/snapshot/reader';
import { FakeFrames } from '../../support/fake-frames';

describe('diffLines / formatDiff', () => {
  it('lists only added and removed lines, with unchanged runs as counts', () => {
    const prev = ['main', ' button "Menu" [e1]', ' link "Home" [e2]'];
    const next = ['main', ' button "Menu" [e1] (expanded)', '  menuitem "Price: low to high" [e3]', '  menuitem "Newest" [e4]', ' link "Home" [e2]'];
    expect(formatDiff(diffLines(prev, next)!)).toEqual([
      '  … 1 unchanged',
      '-  button "Menu" [e1]',
      '+  button "Menu" [e1] (expanded)',
      '+   menuitem "Price: low to high" [e3]',
      '+   menuitem "Newest" [e4]',
    ]);
  });

  it('is empty when nothing changed', () => {
    expect(formatDiff(diffLines(['a', 'b'], ['a', 'b'])!)).toEqual([]);
  });

  it('caps a large change at 60 lines and says how many more changed', () => {
    const prev = Array.from({ length: 200 }, (_, i) => `row "Old ${i}"`);
    const next = Array.from({ length: 200 }, (_, i) => `row "New ${i}"`);
    const out = formatDiff(diffLines(prev, next)!);
    expect(out.filter((l) => /^[+-] /.test(l))).toHaveLength(60);
    expect(out.at(-1)).toBe('… 340 more changed lines not shown. Read the page for the rest.');
  });

  it('gives up on outlines past 4 000 lines', () => {
    expect(diffLines(Array(4001).fill('x'), ['x'])).toBeNull();
  });
});

describe('PageReader.change', () => {
  let frames: FakeFrames;
  let reader: PageReader;
  beforeEach(() => {
    frames = new FakeFrames();
    reader = new PageReader(frames);
  });

  it('shows the outline the first time, then only what changed, then "same"', async () => {
    const frame = frames.load(0, '<button id="menu">Sort</button><div id="items"></div>');
    const first = await reader.change('s', 7);
    expect(first).toMatchObject({ kind: 'outline', reason: 'first look at this page in this session' });
    expect(first.text).toContain('button "Sort" [e1]');
    frame.doc.getElementById('items')!.innerHTML = '<button>Price: low to high</button><button>Newest</button>';
    const opened = await reader.change('s', 7);
    expect(opened.kind).toBe('diff');
    expect(opened.text).toContain('+ button "Price: low to high" [e2]');
    expect(opened.text).toContain('+ button "Newest" [e3]');
    expect(opened.text).not.toContain('Sort');
    expect(await reader.change('s', 7)).toEqual({ kind: 'same', text: '' });
  });

  it('diffs against what this session read, and falls back to the outline on a new document', async () => {
    frames.load(0, '<button>A</button>');
    await reader.read(7, { sessionID: 's' });
    // The tab navigates: a new document, whose refs cannot be compared with the old ones.
    frames.load(0, '<button>B</button>');
    const next = await reader.change('s', 7);
    expect(next).toMatchObject({ kind: 'outline', reason: 'first look at this page in this session' });
    expect(next.text).toContain('button "B"');
  });

  it('ignores focus moving', async () => {
    const frame = frames.load(0, '<input aria-label="Name"><button>Go</button>');
    await reader.read(7, { sessionID: 's' });
    (frame.doc.querySelector('input') as HTMLInputElement).focus();
    expect((await reader.change('s', 7)).kind).toBe('same');
  });
});
