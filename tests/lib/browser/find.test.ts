import { describe, expect, it } from 'vitest';
import { findInLines } from '@/lib/browser/snapshot/find';
import { PageReader } from '@/lib/browser/snapshot/reader';
import { FakeFrames } from '../../support/fake-frames';

// A Hacker News-like page as read_page lines.
const HN = [
  'link [e1] href="https://news.ycombinator.com"',
  'link "Hacker News" [e2] href="news"',
  'link "new" [e3] href="newest"',
  'link "submit" [e9] href="submit"',
  'link "login" [e10] href="login?goto=news"',
  'link "MCP Explained" [e19] href="https://mcp-explained.com/"',
  'link "20 comments" [e24] href="item?id=50379249"',
  'textbox "Search" [e40]',
  'button "Log in with GitHub" [e41]',
  'generic "766 points"',
];

describe('findInLines', () => {
  it('ranks the login link first for "login link"', () => {
    const { matches } = findInLines(HN, 'login link');
    expect(matches[0]).toBe('link "login" [e10] href="login?goto=news"');
  });

  it('matches roles by everyday words', () => {
    expect(findInLines(HN, 'search box').matches[0]).toMatch(/^textbox "Search"/);
    expect(findInLines(HN, 'github button').matches[0]).toMatch(/^button "Log in with GitHub"/);
  });

  it('matches attribute text such as hrefs', () => {
    expect(findInLines(HN, 'mcp-explained.com').matches[0]).toMatch(/^link "MCP Explained"/);
  });

  it('only returns lines with refs and caps at the limit with a total', () => {
    expect(findInLines(HN, '766 points').matches).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => `button "Item ${i}" [e${i + 1}]`);
    const result = findInLines(many, 'item');
    expect(result.matches).toHaveLength(20);
    expect(result.total).toBe(30);
  });

  it('drops elements that matched only a type word when others matched by name', () => {
    const page = ['link "Skip to content" [e1]', 'link "The Internet: home" [e2]', 'link "Click Here" [e3] href="/windows/new"', 'link "Sauce Labs" [e4]'];
    expect(findInLines(page, 'Click Here link').matches).toEqual(['link "Click Here" [e3] href="/windows/new"']);
  });

  it('still lists by role when the query has only a type word', () => {
    expect(findInLines(['link "A" [e1]', 'button "B" [e2]', 'link "C" [e3]'], 'links').matches).toEqual(['link "A" [e1]', 'link "C" [e3]']);
    expect(findInLines(['link "A" [e1]', 'button "B" [e2]', 'link "C" [e3]'], 'link').matches).toEqual(['link "A" [e1]', 'link "C" [e3]']);
  });

  it('returns nothing when no word matches', () => {
    expect(findInLines(HN, 'shopping cart')).toEqual({ matches: [], total: 0 });
  });
});

describe('PageReader.text', () => {
  it('returns the title, URL, source element and main text as untrusted content', async () => {
    const frames = new FakeFrames();
    const frame = frames.load(0, '<nav>Menu</nav><main><h1>Moby-Dick</h1><p>Call me Ishmael.</p></main>', 'https://books.test/moby');
    frame.doc.title = 'Moby-Dick';
    const text = await new PageReader(frames).text(1);
    expect(text).toMatch(/^Title: Moby-Dick\nURL: https:\/\/books\.test\/moby\nSource element: <main>\n---\n<untrusted_page_content/);
    expect(text).toContain('Call me Ishmael.');
    expect(text).not.toContain('Menu');
  });

  it('caps long text with a note', async () => {
    const frames = new FakeFrames();
    frames.load(0, `<main>${Array.from({ length: 400 }, (_, i) => `<p>Line ${i}</p>`).join('')}</main>`);
    const text = await new PageReader(frames).text(1, 600);
    expect(text).toMatch(/\[truncated at \d+ of \d+ chars/);
  });
});
