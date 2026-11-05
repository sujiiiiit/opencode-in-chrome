import { beforeEach, describe, expect, it } from 'vitest';
import { PageReader, truncate } from '@/lib/browser/snapshot/reader';
import { codeOf } from '../../support/fake-chrome';
import { FakeFrames } from '../../support/fake-frames';

let frames: FakeFrames;
let reader: PageReader;
beforeEach(() => {
  frames = new FakeFrames();
  reader = new PageReader(frames);
});

/** The tree part of a read, without the untrusted markers and notes. */
const tree = (text: string) => text.split('\n').filter((l) => !l.startsWith('<') && !l.startsWith('Viewport') && !l.startsWith('[') && !l.startsWith('…'));

describe('PageReader.read', () => {
  it('stitches a child frame under its iframe line with tab-wide refs', async () => {
    frames.load(
      0,
      '<button>Top</button><iframe title="Ad" src="https://ads.test/"></iframe><iframe title="Pay" src="https://pay.test/form"></iframe><a href="/x">After</a>',
    );
    // Frame ids out of DOM order: matching is by URL first.
    frames.load(3, '<input aria-label="Card number"><button>Pay now</button>', 'https://pay.test/form');
    frames.load(4, '<a href="/ad">Buy stuff</a>', 'https://ads.test/');
    const { text } = await reader.read(7);
    expect(tree(text)).toEqual([
      'button "Top" [e1]',
      'iframe "Ad" [e2] src="https://ads.test/" origin="https://ads.test"',
      ' link "Buy stuff" [e3] href="/ad"',
      'iframe "Pay" [e4] src="https://pay.test/form" origin="https://pay.test"',
      ' textbox "Card number" [e5]',
      ' button "Pay now" [e6]',
      'link "After" [e7] href="/x"',
    ]);
    expect(text).toMatch(/^<untrusted_page_content id="[0-9a-f]+">\n/);
    expect(text).toMatch(/Viewport: \d+x\d+, scrolled to 0,0$/);
  });

  it('keeps refs stable across reads and fails closed after navigation', async () => {
    frames.load(0, '<button>A</button><button>B</button>');
    expect(tree((await reader.read(7)).text)).toEqual(['button "A" [e1]', 'button "B" [e2]']);
    expect(tree((await reader.read(7)).text)).toEqual(['button "A" [e1]', 'button "B" [e2]']);
    expect(reader.refs.lookup(7, 'e2')).toMatchObject({ frameId: 0, n: 2 });

    frames.load(0, '<button>New page</button><button>Other</button>'); // navigation: new document
    expect(await codeOf(reader.read(7, { refId: 'e2' }))).toBe('STALE_REF');
    // A fresh read hands out new refs; the old numbers are never reused.
    expect(tree((await reader.read(7)).text)).toEqual(['button "New page" [e3]', 'button "Other" [e4]']);
    expect(await codeOf(reader.read(7, { refId: 'e1' }))).toBe('STALE_REF');
  });

  it('reads one subtree by ref, including a frame inside it', async () => {
    frames.load(0, '<div role="group" tabindex="0" aria-label="Box"><button>In box</button><iframe srcdoc="x"></iframe></div><button>Out</button>');
    // A navigated frame whose URL no longer matches still gets placed, by order.
    frames.load(2, '<button>Framed</button>');
    const all = tree((await reader.read(7)).text);
    expect(all[0]).toBe('group "Box" [e1]');
    expect(tree((await reader.read(7, { refId: 'e1' })).text)).toEqual([
      'group "Box" [e1]',
      ' button "In box" [e2]',
      ' iframe [e3] origin="https://site2.test"',
      '  button "Framed" [e4]',
    ]);
  });

  it('reports a removed element as STALE_REF', async () => {
    const frame = frames.load(0, '<button>Gone soon</button>');
    await reader.read(7);
    frame.doc.querySelector('button')!.remove();
    expect(await codeOf(reader.read(7, { refId: 'e1' }))).toBe('STALE_REF');
    expect(await codeOf(reader.read(7, { refId: 'e99' }))).toBe('STALE_REF');
  });

  it('cuts whole lines to the budget and says how many were left out', async () => {
    frames.load(0, Array.from({ length: 50 }, (_, i) => `<button>Button number ${i}</button>`).join(''));
    const { text } = await reader.read(7, { maxChars: 200 });
    expect(text).toMatch(/… cut to 200 characters, farthest from the viewport first: \d+ more lines not shown \(0 actionable above, \d+ below\)/);
    expect(tree(text)[0]).toBe('button "Button number 0" [e1]');
    expect(tree(text).every((l) => /^button "Button number \d+" \[e\d+\]$/.test(l))).toBe(true);
  });

  it('keeps refs of different tabs apart', async () => {
    frames.load(0, '<button>A</button>');
    await reader.read(1);
    await reader.read(2);
    expect(reader.refs.lookup(1, 'e1')?.documentId).toBe(reader.refs.lookup(2, 'e1')?.documentId);
    reader.refs.forgetTab(1);
    expect(reader.refs.lookup(1, 'e1')).toBeUndefined();
    expect(reader.refs.lookup(2, 'e1')).toBeDefined();
  });
});

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('a\nb', 10)).toEqual({ text: 'a\nb' });
  });
});
