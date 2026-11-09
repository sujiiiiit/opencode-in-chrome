// The service-worker side of page snapshots: injects the snapshot script into every frame,
// walks them, stitches child frames under their iframe lines, and turns each frame's local
// element numbers into refs that are unique for the tab and never reused (design D5).
// A ref remembers the document it came from, so after a navigation it fails as STALE_REF
// instead of pointing at an element of the new page.
import { PAGE_API_KEY, type PageApi, type PageWalk, type PageWalkArgs } from '../page/page-api';
import type { ProbeArgs, ProbeResult } from '../page/wait-page';
import type { WalkFilter } from './walker';
import { applyWindow, type OutlineLine, type WindowMode } from './window';
import { diffLines, formatDiff } from './diff';
import { ToolError, untrusted } from '../tools/registry';

export type FrameResult<T> = { frameId: number; documentId?: string; result?: T };
export type ScriptTarget = { tabId: number; allFrames?: boolean; documentIds?: string[] };

export type FrameInfo = { frameId: number; parentFrameId: number; url: string };

/** The chrome.scripting (+ webNavigation) surface used here, injectable for tests. */
export type ScriptingApi = {
  /** Injects the snapshot script into every frame (idempotent in the page). */
  inject(tabId: number): Promise<void>;
  run<A, T>(target: ScriptTarget, func: (args: A) => T, args: A): Promise<Array<FrameResult<T>>>;
  /** The tab's frame tree (webNavigation.getAllFrames), ordered by frame id. */
  frames(tabId: number): Promise<FrameInfo[]>;
};

export type RefTarget = { frameId: number; documentId: string; n: number };

const DEFAULT_MAX_CHARS = 30_000;
const SCRIPT_TIMEOUT_MS = 10_000;

/** Tab-wide refs (`e57`) for (document, local number) pairs. */
class RefDirectory {
  private readonly tabs = new Map<number, { next: number; byRef: Map<string, RefTarget>; byKey: Map<string, string> }>();

  private tab(tabId: number) {
    let entry = this.tabs.get(tabId);
    if (!entry) {
      entry = { next: 1, byRef: new Map(), byKey: new Map() };
      this.tabs.set(tabId, entry);
    }
    return entry;
  }

  assign(tabId: number, target: RefTarget): string {
    const entry = this.tab(tabId);
    const key = `${target.documentId}:${target.n}`;
    let ref = entry.byKey.get(key);
    if (!ref) {
      ref = `e${entry.next++}`;
      entry.byKey.set(key, ref);
      entry.byRef.set(ref, target);
    }
    return ref;
  }

  lookup(tabId: number, ref: string): RefTarget | undefined {
    return this.tabs.get(tabId)?.byRef.get(ref.trim());
  }

  /** The ref already given to an element, if any (for change reports). */
  refFor(tabId: number, documentId: string, n: number): string | undefined {
    return this.tabs.get(tabId)?.byKey.get(`${documentId}:${n}`);
  }

  forgetTab(tabId: number): void {
    this.tabs.delete(tabId);
  }
}

export function staleRef(ref: string): ToolError {
  return new ToolError(
    'STALE_REF',
    `No element ${ref} on the page now: it was removed or the page changed. Call read_page or find again for fresh refs.`,
  );
}

// These run inside the page (serialised by executeScript): they may only use their argument.
function walkInPage(args: PageWalkArgs & { key: string }): PageWalk | undefined {
  const api = (globalThis as unknown as Record<string, PageApi | undefined>)[args.key];
  return api?.walk(args);
}

function textInPage(args: { key: string }): ReturnType<PageApi['text']> | undefined {
  const api = (globalThis as unknown as Record<string, PageApi | undefined>)[args.key];
  return api?.text();
}

function probeInPage(args: ProbeArgs & { key: string }): ProbeResult | undefined {
  const api = (globalThis as unknown as Record<string, PageApi | undefined>)[args.key];
  return api?.probe(args);
}

export function mergeProbes(answers: ProbeResult[], args: ProbeArgs): ProbeResult | undefined {
  if (!answers.length) return undefined;
  const out: ProbeResult = {
    texts: (args.texts ?? []).map((_, i) => answers.some((a) => a.texts[i] === true)),
    selectors: (args.selectors ?? []).map((_, i) =>
      answers.every((a) => a.selectors[i] === null) ? null : answers.some((a) => a.selectors[i] === true),
    ),
  };
  if (args.idleMs !== undefined) out.idle = answers.every((a) => a.idle === true);
  return out;
}

export type PageMethod = 'locate' | 'fill' | 'setFiles' | 'settle' | 'viewport' | 'focused' | 'drop' | 'extract' | 'navStatus';

function callInPage(args: { key: string; method: PageMethod; params: unknown[] }): unknown {
  const api = (globalThis as unknown as Record<string, Record<string, (...a: unknown[]) => unknown> | undefined>)[args.key];
  if (!api) return { error: 'STALE_REF', message: 'no page api' };
  return api[args.method]!(...args.params);
}

/** The page after an action, for its result: the diff, the whole windowed outline (and why), or no change. */
export type PageChange = { kind: 'diff' | 'outline' | 'same'; text: string; reason?: string };

/** Focus moves on almost every click; a change of focus alone is not a change worth showing. */
export const withoutFocus = (line: string) => line.replace(/ \(focused\)/, '').replace(/, focused\)/, ')').replace(/\(focused, /, '(');

export type ReadOptions = { filter?: WalkFilter; depth?: number; refId?: string; maxChars?: number; window?: WindowMode };

type Walked = { frameId: number; documentId: string; walk: Exclude<PageWalk, { stale: true }> };

/** One stitching pass: every frame's walk and, per parent frame, its not-yet-placed children. */
type Stitch = { walks: Map<number, Walked>; pending: Map<number, FrameInfo[]>; used: Set<number> };

const MARKER = /\s\{iframe:([^}]*)\}$/;
const LOCAL_REF = /\[@(\d+)\]/g;

/** The child frame an iframe line stands for: same URL first, else the next in frame order. */
function takeChild(stitch: Stitch, parentFrameId: number, url: string): Walked | undefined {
  const candidates = stitch.pending.get(parentFrameId);
  if (!candidates?.length) return undefined;
  let index = candidates.findIndex((f) => f.url === url);
  if (index < 0) index = 0;
  const [picked] = candidates.splice(index, 1);
  return picked ? stitch.walks.get(picked.frameId) : undefined;
}

export class PageReader {
  /** Per tab: child frame id → the iframe element that holds it (as a ref target in its parent). */
  private readonly parents = new Map<number, Map<number, RefTarget>>();

  private readonly scripting: ScriptingApi;

  constructor(
    scripting: ScriptingApi,
    readonly refs: RefDirectory = new RefDirectory(),
    /** Runs before any script reaches the tab; throws to refuse (an open dialog would hang it). */
    guard: (tabId: number) => void = () => undefined,
  ) {
    this.scripting = {
      inject: async (tabId) => {
        guard(tabId);
        return scripting.inject(tabId);
      },
      run: async (target, func, args) => {
        guard(target.tabId);
        return scripting.run(target, func, args);
      },
      frames: (tabId) => scripting.frames(tabId),
    };
  }

  /** The iframe element hosting `frameId`, as placed by the last read of the tab. */
  parentOf(tabId: number, frameId: number): RefTarget | undefined {
    return this.parents.get(tabId)?.get(frameId);
  }

  forgetTab(tabId: number): void {
    this.refs.forgetTab(tabId);
    this.parents.delete(tabId);
    for (const key of this.seen.keys()) if (key.endsWith(`:${tabId}`)) this.seen.delete(key);
  }

  /**
   * Calls a page API method in one document. A document that no longer exists, or an
   * element that is gone, comes back as `{ error: 'STALE_REF' }`.
   */
  async call<T>(tabId: number, documentId: string, method: PageMethod, params: unknown[] = []): Promise<T> {
    let results: Array<FrameResult<unknown>>;
    try {
      results = await this.withTimeout(this.scripting.run({ tabId, documentIds: [documentId] }, callInPage, { key: PAGE_API_KEY, method, params }));
    } catch (error) {
      if (error instanceof ToolError) throw error;
      return { error: 'STALE_REF', message: 'document gone' } as T;
    }
    return (results[0]?.result ?? { error: 'STALE_REF', message: 'document gone' }) as T;
  }

  /** Calls a page API method in the tab's top frame (injecting the script if needed). */
  async callTop<T>(tabId: number, method: PageMethod, params: unknown[] = []): Promise<T | undefined> {
    await this.withTimeout(this.scripting.inject(tabId));
    const [top] = await this.withTimeout(this.scripting.run({ tabId }, callInPage, { key: PAGE_API_KEY, method, params }));
    return top?.result as T | undefined;
  }

  private async withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new ToolError('TIMEOUT', 'The page did not answer in 10 s (a dialog may be open or the page is frozen).')),
        SCRIPT_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Every frame's walk (frames that failed or have no API are left out) and the frame tree. */
  private async walkFrames(tabId: number, args: PageWalkArgs): Promise<Stitch> {
    await this.withTimeout(this.scripting.inject(tabId));
    const [results, tree] = await this.withTimeout(
      Promise.all([this.scripting.run({ tabId, allFrames: true }, walkInPage, { ...args, key: PAGE_API_KEY }), this.scripting.frames(tabId)]),
    );
    const walks = new Map<number, Walked>();
    for (const r of results) {
      if (!r.result || 'stale' in r.result || !r.documentId) continue;
      walks.set(r.frameId, { frameId: r.frameId, documentId: r.documentId, walk: r.result });
    }
    const pending = new Map<number, FrameInfo[]>();
    for (const frame of [...tree].sort((a, b) => a.frameId - b.frameId)) {
      if (frame.parentFrameId < 0) continue;
      pending.set(frame.parentFrameId, [...(pending.get(frame.parentFrameId) ?? []), frame]);
    }
    return { walks, pending, used: new Set() };
  }

  /**
   * Renders a frame's lines with tab refs, recursing into child frames at their iframe lines.
   * Boxes move into top-viewport coordinates: a child frame's are offset by its iframe's top.
   */
  private render(tabId: number, frame: Walked, stitch: Stitch, indent: number, offset = 0): OutlineLine[] {
    stitch.used.add(frame.frameId);
    const out: OutlineLine[] = [];
    frame.walk.lines.forEach((raw, i) => {
      const marker = MARKER.exec(raw);
      const text = (marker ? raw.slice(0, marker.index) : raw).replace(LOCAL_REF, (_, n: string) => {
        const ref = this.refs.assign(tabId, { frameId: frame.frameId, documentId: frame.documentId, n: Number(n) });
        return `[${ref}]`;
      });
      const own = frame.walk.boxes?.[i] ?? null;
      const box: OutlineLine['box'] = own ? [own[0] + offset, own[1]] : null;
      out.push({ text: ' '.repeat(indent) + text, box });
      if (!marker) return;
      const child = takeChild(stitch, frame.frameId, decodeURIComponent(marker[1]!));
      if (!child || stitch.used.has(child.frameId)) return;
      const host = /\[@(\d+)\]/.exec(raw);
      if (host) {
        const parents = this.parents.get(tabId) ?? new Map<number, RefTarget>();
        parents.set(child.frameId, { frameId: frame.frameId, documentId: frame.documentId, n: Number(host[1]) });
        this.parents.set(tabId, parents);
      }
      const depth = raw.length - raw.trimStart().length;
      const origin = originOf(child.walk.url);
      if (origin) out[out.length - 1]!.text += ` origin=${JSON.stringify(origin)}`;
      out.push(...this.render(tabId, child, stitch, indent + depth + 1, box ? box[0] : offset));
    });
    return out;
  }

  /** Frames no iframe line claimed (rare: hidden or detached iframes), listed at the end. */
  private leftovers(tabId: number, stitch: Stitch): OutlineLine[] {
    const out: OutlineLine[] = [];
    for (const frame of stitch.walks.values()) {
      if (stitch.used.has(frame.frameId)) continue;
      out.push({ text: `frame ${JSON.stringify(frame.walk.url)}`, box: null }, ...this.render(tabId, frame, stitch, 1));
    }
    return out;
  }

  /**
   * `read_page`: the tree as text, bounded by `maxChars`, page text marked untrusted. With a
   * session, a whole-page read becomes that session's last outline of the tab (for diffs).
   */
  async read(tabId: number, options: ReadOptions & { sessionID?: string } = {}): Promise<{ text: string; capped: boolean }> {
    const outline = await this.outline(tabId, options);
    if (options.sessionID && !options.refId) this.remember(options.sessionID, tabId, outline, options);
    return { text: formatReadText(outline.lines, outline.notes, outline.top, outline.capped, outline.maxChars), capped: outline.capped };
  }

  private async outline(tabId: number, options: ReadOptions) {
    const args: PageWalkArgs = { filter: options.filter ?? 'interactive', depth: options.depth };
    const stitch = await this.walkFrames(tabId, args);
    const root = options.refId ? await this.readRef(tabId, options.refId, args) : stitch.walks.get(0);
    if (!root) throw new ToolError('RESTRICTED_PAGE', 'The page cannot be read (it may still be loading). Wait a moment, or navigate to a web page.');

    const lines = this.render(tabId, root, stitch, 0);
    if (!options.refId) lines.push(...this.leftovers(tabId, stitch));
    const capped = [...stitch.walks.values()].some((f) => f.walk.capped) || root.walk.capped;
    const top = stitch.walks.get(0)?.walk ?? root.walk;
    // A ref_id scope prints its subtree whole; a page read is windowed around the viewport.
    const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
    const windowed = options.refId
      ? { lines: lines.map((l) => l.text), notes: [] }
      : applyWindow(lines, top.viewport.height, options.window ?? 'near', maxChars);
    return { ...windowed, top, capped, maxChars, documentId: root.documentId };
  }

  /** What each session last saw of each tab: the outline lines, the top document, and how it was read. */
  private readonly seen = new Map<string, { documentId: string; lines: string[]; options: ReadOptions }>();

  private remember(sessionID: string, tabId: number, outline: { lines: string[]; documentId: string }, options: ReadOptions): void {
    this.seen.set(`${sessionID}:${tabId}`, { documentId: outline.documentId, lines: outline.lines.map(withoutFocus), options: { filter: options.filter, depth: options.depth, window: options.window } });
  }

  /**
   * After an action: the page as the change since the outline this session last saw of the
   * tab (read the same way), or the whole windowed outline when the session has none for this
   * document. The new outline becomes the session's last one.
   */
  async change(sessionID: string, tabId: number): Promise<PageChange> {
    const last = this.seen.get(`${sessionID}:${tabId}`);
    const outline = await this.outline(tabId, last?.options ?? {});
    const lines = outline.lines.map(withoutFocus);
    this.remember(sessionID, tabId, outline, last?.options ?? {});
    const full = () => untrusted(outline.lines.join('\n') || '(no matching elements)') + (outline.notes.length ? '\n' + outline.notes.join('\n') : '');
    if (!last) return { kind: 'outline', reason: 'first look at this page in this session', text: full() };
    if (last.documentId !== outline.documentId) return { kind: 'outline', reason: 'first look at this page in this session', text: full() };
    const ops = diffLines(last.lines, lines);
    if (!ops) return { kind: 'outline', reason: 'the page is too large to compare', text: full() };
    const changed = formatDiff(ops);
    if (!changed.length) return { kind: 'same', text: '' };
    return { kind: 'diff', text: untrusted(changed.join('\n')) };
  }

  private async readRef(tabId: number, refId: string, args: PageWalkArgs): Promise<Walked> {
    const target = this.refs.lookup(tabId, refId);
    if (!target) throw staleRef(refId);
    let results: Array<FrameResult<PageWalk | undefined>>;
    try {
      results = await this.withTimeout(
        this.scripting.run({ tabId, documentIds: [target.documentId] }, walkInPage, { ...args, rootRef: target.n, key: PAGE_API_KEY }),
      );
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw staleRef(refId);
    }
    const walked = results[0]?.result;
    if (!walked || 'stale' in walked) throw staleRef(refId);
    return { frameId: target.frameId, documentId: target.documentId, walk: walked };
  }

  /** `get_page_text`: title, URL and readable main text of the page, with the text of its iframes after it. */
  async text(tabId: number, maxChars = DEFAULT_MAX_CHARS): Promise<string> {
    await this.withTimeout(this.scripting.inject(tabId));
    const results = await this.withTimeout(this.scripting.run({ tabId, allFrames: true }, textInPage, { key: PAGE_API_KEY }));
    const page = (results.find((r) => r.frameId === 0) ?? results[0])?.result;
    if (!page) throw new ToolError('RESTRICTED_PAGE', 'The page cannot be read (it may still be loading). Wait a moment, or navigate to a web page.');
    const framed = results.filter((r) => r.frameId !== 0 && r.result?.text).map((r) => `[iframe ${r.result!.url}]\n${r.result!.text}`);
    const body = truncate([page.text || (framed.length ? '' : '(no text)'), ...framed].filter(Boolean).join('\n\n'), maxChars);
    const header = `Title: ${page.title}\nURL: ${page.url}\nSource element: ${page.source}\n---`;
    return `${header}\n${untrusted(body.text)}${body.note ? '\n' + body.note : ''}`;
  }

  /**
   * One `wait_for` check across every frame: a text or selector holds when any frame has it
   * (a selector is null only when every frame rejected it), idle when every frame that
   * answered is idle. Undefined when no frame answered.
   */
  async probe(tabId: number, args: ProbeArgs): Promise<ProbeResult | undefined> {
    await this.withTimeout(this.scripting.inject(tabId));
    const results = await this.withTimeout(this.scripting.run({ tabId, allFrames: true }, probeInPage, { ...args, key: PAGE_API_KEY }));
    return mergeProbes(results.map((r) => r.result as ProbeResult | undefined).filter((r): r is ProbeResult => !!r), args);
  }

  /** Lines of the whole page with refs (no untrusted wrapper), for `find` and change reports. */
  async lines(tabId: number, filter: WalkFilter = 'all'): Promise<string[]> {
    const stitch = await this.walkFrames(tabId, { filter, depth: 40 });
    const top = stitch.walks.get(0);
    if (!top) return [];
    return [...this.render(tabId, top, stitch, 0), ...this.leftovers(tabId, stitch)].map((l) => l.text);
  }
}

function formatReadText(lines: string[], windowNotes: string[], top: Walked['walk'], capped: boolean, maxChars: number): string {
  // The window has already fit a page read to the budget; this only cuts a ref_id subtree.
  const body = truncate(lines.length ? lines.join('\n') : '(no matching elements)', maxChars);
  const v = top.viewport;
  const notes = [...windowNotes, `Viewport: ${v.width}x${v.height}, scrolled to ${v.scrollX},${v.scrollY}`];
  if (capped) notes.push('[The page is very large: the walk stopped early. Use ref_id or find to look at a part of it.]');
  return `${untrusted(body.text)}\n${body.note ? body.note + '\n' : ''}${notes.join('\n')}`;
}

function originOf(url: string): string | undefined {
  try {
    const origin = new URL(url).origin;
    return origin === 'null' ? undefined : origin;
  } catch {
    return undefined;
  }
}

/** Cuts at a line boundary and says how big the whole thing was. */
export function truncate(text: string, maxChars: number): { text: string; note?: string } {
  if (text.length <= maxChars) return { text };
  const cut = text.lastIndexOf('\n', maxChars);
  const kept = text.slice(0, cut > 0 ? cut : maxChars);
  return {
    text: kept,
    note: `[truncated at ${kept.length} of ${text.length} chars: pass ref_id, a smaller depth, or use find]`,
  };
}
