// The API the snapshot script installs in every frame's isolated world. The service
// worker calls it with chrome.scripting.executeScript({ func }) — so each call is a small
// self-contained function that reaches this object through a global.
import { ElementRegistry, pageText, walk, type WalkOptions } from '../snapshot/walker';
import {
  drop,
  fill,
  focusedInfo,
  indicator,
  locate,
  setFiles,
  settle,
  type FillResult,
  type PageError,
  type TargetInfo,
  type UploadFile,
} from './actions-page';

export const PAGE_API_KEY = '__opencodeBrowserPage';

export type PageWalkArgs = Pick<WalkOptions, 'filter' | 'depth' | 'rootRef'>;

export type PageWalk = ReturnType<typeof walk> | { stale: true };

export type PageApi = {
  /** `{ stale: true }` when `rootRef` is no longer in this document (never throws: results cross executeScript). */
  walk(args: PageWalkArgs): PageWalk;
  text(): ReturnType<typeof pageText>;
  /** Whether a local element number is still live in this document. */
  has(ref: number): boolean;
  locate(ref: number, checkCover?: boolean): TargetInfo | PageError;
  fill(ref: number, value: string | number | boolean): FillResult | PageError;
  setFiles(ref: number, files: UploadFile[]): { label: string; names: string[] } | PageError;
  settle(quietMs: number, capMs: number): Promise<boolean>;
  viewport(): { width: number; height: number; dpr: number; scrollX: number; scrollY: number };
  focused(): ReturnType<typeof focusedInfo>;
  drop(x: number, y: number, file: UploadFile): boolean;
  indicator(mode: 'show' | 'hide' | 'unhide' | 'remove'): boolean;
  registry: ElementRegistry;
};

export type PageEnv = {
  shadowRootOf?: (el: Element) => ShadowRoot | null;
};

export function createPageApi(doc: Document, env: PageEnv = {}): PageApi {
  const registry = new ElementRegistry();
  return {
    registry,
    walk: (args) => {
      if (args.rootRef !== undefined && !registry.get(args.rootRef)) return { stale: true };
      return walk(doc, registry, { ...args, shadowRootOf: env.shadowRootOf });
    },
    text: () => pageText(doc),
    has: (ref) => registry.get(ref) !== undefined,
    locate: (ref, checkCover = true) => locate(registry, doc, ref, checkCover),
    fill: (ref, value) => fill(registry, ref, value),
    setFiles: (ref, files) => setFiles(registry, ref, files),
    settle: (quietMs, capMs) => settle(doc, quietMs, capMs),
    focused: () => focusedInfo(doc),
    drop: (x, y, file) => drop(doc, x, y, file),
    indicator: (mode) => indicator(doc, mode),
    viewport: () => {
      const view = doc.defaultView!;
      return {
        width: view.innerWidth,
        height: view.innerHeight,
        dpr: view.devicePixelRatio || 1,
        scrollX: Math.round(view.scrollX),
        scrollY: Math.round(view.scrollY),
      };
    },
  };
}

/** Installs the API once per document (re-injection keeps the existing registry). */
export function installPageApi(target: Record<string, unknown>, doc: Document, env: PageEnv): PageApi {
  const existing = target[PAGE_API_KEY] as PageApi | undefined;
  if (existing) return existing;
  const api = createPageApi(doc, env);
  Object.defineProperty(target, PAGE_API_KEY, { value: api, configurable: false, enumerable: false });
  return api;
}
