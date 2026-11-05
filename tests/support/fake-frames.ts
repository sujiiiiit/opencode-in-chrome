// Fake frames for the page reader: each frame is its own happy-dom document with the real
// page API installed, and `run` calls the serialisable page function against it exactly as
// chrome.scripting.executeScript would (one result per targeted frame).
import { createPageApi, PAGE_API_KEY, type PageApi } from '@/lib/browser/page/page-api';
import type { FrameInfo, FrameResult, ScriptingApi, ScriptTarget } from '@/lib/browser/snapshot/reader';

export type FakeFrame = { frameId: number; parentFrameId: number; documentId: string; doc: Document; api: PageApi; url: string };

export class FakeFrames implements ScriptingApi {
  list: FakeFrame[] = [];
  injections = 0;
  private docSeq = 0;

  /**
   * Adds (or replaces, as a navigation would) a frame with this HTML. Child frames default
   * to the top frame as parent; the reader matches them to iframe lines by URL, then order.
   */
  load(frameId: number, html: string, url = `https://site${frameId}.test/`, parentFrameId = frameId === 0 ? -1 : 0): FakeFrame {
    const doc = document.implementation.createHTMLDocument('frame');
    doc.body.innerHTML = html;
    Object.defineProperty(doc, 'location', { value: { href: url }, configurable: true });
    const api = createPageApi(doc);
    const frame = { frameId, parentFrameId, documentId: `doc-${++this.docSeq}`, doc, api, url };
    this.list = [...this.list.filter((f) => f.frameId !== frameId), frame];
    return frame;
  }

  async inject(): Promise<void> {
    this.injections += 1;
  }

  async frames(): Promise<FrameInfo[]> {
    return this.list.map((f) => ({ frameId: f.frameId, parentFrameId: f.parentFrameId, url: f.url }));
  }

  async run<A, T>(target: ScriptTarget, func: (args: A) => T, args: A): Promise<Array<FrameResult<T>>> {
    const chosen = target.documentIds
      ? this.list.filter((f) => target.documentIds!.includes(f.documentId))
      : target.allFrames
        ? this.list
        : this.list.filter((f) => f.frameId === 0);
    if (target.documentIds && chosen.length === 0) throw new Error('No document with id ' + target.documentIds.join());
    const g = globalThis as unknown as Record<string, unknown>;
    return chosen.map((frame) => {
      g[PAGE_API_KEY] = frame.api;
      try {
        return { frameId: frame.frameId, documentId: frame.documentId, result: func(args) };
      } finally {
        delete g[PAGE_API_KEY];
      }
    });
  }
}
