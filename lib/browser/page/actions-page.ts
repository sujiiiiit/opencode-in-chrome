// Page-side helpers for actions (they run in the frame's isolated world, through the page
// API): locating an element for real input, filling form controls, waiting for the DOM to
// settle, and putting files into file inputs. Results are plain JSON (they cross
// executeScript) and never throw; failures come back as `{ error: CODE, message }`.
import type { ElementRegistry } from '../snapshot/walker';
import { nameOf, roleOf } from '../snapshot/walker';

export type PageError = { error: 'STALE_REF' | 'OBSCURED' | 'NOT_INTERACTABLE' | 'INVALID_INPUT'; message: string };

export type TargetInfo = {
  /** Centre of the visible box, CSS px relative to this frame's viewport. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** For iframes: where the frame's content starts inside the box (border + padding). */
  contentLeft: number;
  contentTop: number;
  label: string;
  tag: string;
  type: string;
  /** Text-entry fields that hold secrets or one-time codes (hand-off rule). */
  secret: 'password' | 'otp' | 'card' | null;
  /** Whether a click here submits a form. */
  submits: boolean;
  inForm: boolean;
  /** A link's resolved destination, for the pre-click site gate. */
  url?: string;
};

const describe = (el: Element): string => {
  const role = roleOf(el);
  const name = nameOf(el, role);
  return name ? `${role} ${JSON.stringify(name)}` : role;
};

function deepElementFromPoint(doc: Document, x: number, y: number): Element | null {
  let hit = doc.elementFromPoint(x, y);
  while (hit?.shadowRoot) {
    const inner = hit.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === hit) break;
    hit = inner;
  }
  return hit;
}

/** Whether `inner` is `outer` or inside it, crossing shadow boundaries. */
function containsDeep(outer: Element, inner: Element | null): boolean {
  let node: Node | null = inner;
  while (node) {
    if (node === outer) return true;
    node = node.parentNode ?? (node as ShadowRoot).host ?? null;
  }
  return false;
}

/** The label of the element that sits on top of the target (for OBSCURED). */
function coverLabel(hit: Element): string {
  let el: Element | null = hit;
  // Climb to something with a name: a banner or dialog is more useful than an inner span.
  for (let i = 0; el && i < 6; i++) {
    const role = roleOf(el);
    if (['dialog', 'alertdialog', 'banner', 'region', 'navigation', 'complementary', 'contentinfo'].includes(role)) break;
    if (el.id || el.getAttribute('aria-label')) break;
    el = el.parentElement;
  }
  const target = el ?? hit;
  const id = target.id ? `#${target.id}` : '';
  return `${describe(target)}${id ? ` (${target.tagName.toLowerCase()}${id})` : ''}`;
}

function secretKind(el: Element): TargetInfo['secret'] {
  if (el.tagName !== 'INPUT') return null;
  const input = el as HTMLInputElement;
  const hints = `${input.name} ${input.id} ${input.autocomplete} ${input.getAttribute('aria-label') ?? ''} ${input.placeholder}`.toLowerCase();
  if (input.type === 'password' || /current-password|new-password/.test(input.autocomplete)) return 'password';
  if (/one-time-code/.test(input.autocomplete) || /\b(otp|one.?time|2fa|verification code|totp)\b/.test(hints)) return 'otp';
  if (/^cc-(number|csc|exp)/.test(input.autocomplete) || /\b(card.?number|cvv|cvc|security code)\b/.test(hints)) return 'card';
  return null;
}

function submits(el: Element): boolean {
  const tag = el.tagName;
  const form = (el as HTMLButtonElement).form ?? el.closest('form');
  if (!form) return false;
  if (tag === 'BUTTON') return ((el as HTMLButtonElement).type || 'submit') === 'submit';
  if (tag === 'INPUT') return ['submit', 'image'].includes((el as HTMLInputElement).type);
  return false;
}

/**
 * Scrolls the element into view and returns where to click it, or why not: removed
 * (STALE_REF), disabled or without a box (NOT_INTERACTABLE), or covered (OBSCURED).
 * `checkCover` is false for iframes on the path to a nested target and for scroll_to.
 */
export function locate(registry: ElementRegistry, doc: Document, n: number, checkCover = true): TargetInfo | PageError {
  const el = registry.get(n);
  if (!el) return { error: 'STALE_REF', message: 'removed' };
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior });
  const view = doc.defaultView!;
  const rect = el.getBoundingClientRect();
  const label = describe(el);
  const style = view.getComputedStyle(el);
  const problem = interactabilityError(el, label, rect, style);
  if (problem) return problem;
  const point = visiblePoint(rect, view, label);
  if ('error' in point) return point;
  if (checkCover) {
    const cover = coverError(el, doc, point.x, point.y, label);
    if (cover) return cover;
  }
  return {
    ...point,
    width: rect.width,
    height: rect.height,
    contentLeft: rect.left + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.paddingLeft) || 0),
    contentTop: rect.top + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.paddingTop) || 0),
    label,
    tag: el.tagName.toLowerCase(),
    type: (el as HTMLInputElement).type ?? '',
    secret: secretKind(el),
    submits: submits(el),
    inForm: !!el.closest('form'),
    ...(el.tagName === 'A' && (el as HTMLAnchorElement).href ? { url: (el as HTMLAnchorElement).href } : {}),
  };
}

function interactabilityError(el: Element, label: string, rect: DOMRect, style: CSSStyleDeclaration): PageError | undefined {
  if (rect.width < 1 || rect.height < 1) return { error: 'NOT_INTERACTABLE', message: `${label} has no visible size (it may be hidden or collapsed). Open the menu, tab or section that holds it, then find it again.` };
  if (style.visibility === 'hidden' || style.display === 'none') return { error: 'NOT_INTERACTABLE', message: `${label} is hidden. Open the menu, tab or section that holds it, then find it again.` };
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return { error: 'NOT_INTERACTABLE', message: `${label} is disabled. Something must be done first (a required field, an option): read_page shows what is missing.` };
  return undefined;
}

function visiblePoint(rect: DOMRect, view: Window, label: string): { x: number; y: number } | PageError {
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, view.innerWidth);
  const bottom = Math.min(rect.bottom, view.innerHeight);
  if (right <= left || bottom <= top) return { error: 'NOT_INTERACTABLE', message: `${label} could not be scrolled into view. Scroll the area that holds it, or find it again.` };
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

function coverError(el: Element, doc: Document, x: number, y: number, label: string): PageError | undefined {
  const hit = deepElementFromPoint(doc, x, y);
  if (!hit || containsDeep(el, hit) || el.tagName === 'LABEL' || containsDeep(hit, el)) return undefined;
  if ((hit as HTMLLabelElement).control === el) return undefined;
  return { error: 'OBSCURED', message: `${label} is covered by ${coverLabel(hit)}. Close or accept that first (find its button), then try again.` };
}

/** The focused element (through shadow roots): what `type` and `key` will reach. */
export function focusedInfo(doc: Document): { label: string; secret: TargetInfo['secret']; editable: boolean; inForm: boolean } | null {
  let el: Element | null = doc.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  if (!el || el === doc.body || el === doc.documentElement) return null;
  const tag = el.tagName;
  const editable =
    tag === 'TEXTAREA' ||
    (tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image'].includes((el as HTMLInputElement).type)) ||
    (el as HTMLElement).isContentEditable;
  return { label: describe(el), secret: secretKind(el), editable, inForm: !!el.closest('form') };
}

const VALUE_SETTERS: Record<string, PropertyDescriptor | undefined> = {};
function nativeSetter(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): (v: string) => void {
  const proto = Object.getPrototypeOf(el) as object;
  const key = proto.constructor.name;
  VALUE_SETTERS[key] ??= Object.getOwnPropertyDescriptor(proto, 'value');
  const setter = VALUE_SETTERS[key]?.set;
  return (v) => (setter ? setter.call(el, v) : (el.value = v));
}

const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, composed: true }));

export type FillResult = { label: string; previous: string; value: string };

/** form_input: sets a control's value so page frameworks see the change (design D6). */
export function fill(registry: ElementRegistry, n: number, value: string | number | boolean): FillResult | PageError {
  const el = registry.get(n);
  if (!el) return { error: 'STALE_REF', message: 'removed' };
  const label = describe(el);
  if ((el as HTMLInputElement).disabled) return { error: 'NOT_INTERACTABLE', message: `${label} is disabled.` };
  if (el.tagName === 'SELECT') return fillSelect(el as HTMLSelectElement, label, value);
  if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes((el as HTMLInputElement).type)) return fillChoice(el as HTMLInputElement, label, value);
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return fillText(el as HTMLInputElement, label, value);
  if ((el as HTMLElement).isContentEditable) return fillEditable(el as HTMLElement, label, value);
  return { error: 'INVALID_INPUT', message: `${label} is not a form field (input, textarea, select, checkbox, radio or editable region).` };
}

function fillSelect(select: HTMLSelectElement, label: string, value: string | number | boolean): FillResult | PageError {
  const previous = select.selectedOptions[0]?.textContent?.trim() ?? '';
  const wanted = String(value).trim().toLowerCase();
  const options = Array.from(select.options);
  const option = options.find((o) => o.value.toLowerCase() === wanted) ?? options.find((o) => (o.textContent ?? '').trim().toLowerCase() === wanted);
  if (!option) {
    const list = options.map((o) => `${JSON.stringify((o.textContent ?? '').trim())} (${JSON.stringify(o.value)})`).join(', ');
    return { error: 'INVALID_INPUT', message: `${label} has no option ${JSON.stringify(String(value))}. Options: ${list}.` };
  }
  nativeSetter(select)(option.value);
  option.selected = true;
  fire(select, 'input');
  fire(select, 'change');
  return { label, previous, value: (option.textContent ?? '').trim() };
}

function fillChoice(input: HTMLInputElement, label: string, value: string | number | boolean): FillResult | PageError {
  const want = value === true || value === 'true' || value === 'on' || value === 1;
  const previous = String(input.checked);
  if (input.type === 'radio' && !want) {
    return { error: 'INVALID_INPUT', message: `${label}: a radio button can only be selected (true); select another option instead.` };
  }
  if (input.checked !== want) input.click();
  if (input.checked !== want) {
    input.checked = want;
    fire(input, 'input');
    fire(input, 'change');
  }
  return { label, previous, value: String(input.checked) };
}

function fillText(input: HTMLInputElement, label: string, value: string | number | boolean): FillResult | PageError {
  if (input.type === 'file') return { error: 'INVALID_INPUT', message: `${label} is a file input: use file_upload.` };
  const previous = input.type === 'password' ? (input.value ? '\u2022\u2022\u2022' : '') : input.value;
  input.focus();
  nativeSetter(input)(String(value));
  fire(input, 'input');
  fire(input, 'change');
  return { label, previous, value: input.type === 'password' ? '\u2022\u2022\u2022' : input.value };
}

function fillEditable(html: HTMLElement, label: string, value: string | number | boolean): FillResult {
  const previous = html.textContent ?? '';
  html.focus();
  const selection = html.ownerDocument.getSelection();
  const range = html.ownerDocument.createRange();
  range.selectNodeContents(html);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const inserted = html.ownerDocument.execCommand?.('insertText', false, String(value));
  if (!inserted || html.textContent !== String(value)) {
    html.textContent = String(value);
    fire(html, 'input');
  }
  return { label, previous, value: html.textContent ?? '' };
}

/** Resolves once the DOM has had no mutations for `quietMs`, or after `capMs`. */
export function settle(doc: Document, quietMs: number, capMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const done = (quiet: boolean) => {
      observer.disconnect();
      clearTimeout(timer);
      clearTimeout(cap);
      resolve(quiet);
    };
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => done(true), quietMs);
    });
    observer.observe(doc, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = setTimeout(() => done(true), quietMs);
    const cap = setTimeout(() => done(false), capMs);
  });
}



export type UploadFile = { name: string; type: string; base64: string };

const toFile = (f: UploadFile) => new File([Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0))], f.name, { type: f.type || 'application/octet-stream' });

/** upload_image by coordinate: drag-and-drop events carrying the file at a viewport point. */
export function drop(doc: Document, x: number, y: number, file: UploadFile): boolean {
  const target = deepElementFromPoint(doc, x, y);
  if (!target) return false;
  const transfer = new DataTransfer();
  transfer.items.add(toFile(file));
  const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, dataTransfer: transfer };
  for (const type of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new DragEvent(type, init));
  return true;
}

/** file_upload: puts files into a file input without the native picker. */
export function setFiles(registry: ElementRegistry, n: number, files: UploadFile[]): { label: string; names: string[] } | PageError {
  const el = registry.get(n);
  if (!el) return { error: 'STALE_REF', message: 'removed' };
  const label = describe(el);
  if (el.tagName !== 'INPUT' || (el as HTMLInputElement).type !== 'file') {
    return { error: 'INVALID_INPUT', message: `${label} is not a file input. Use find to locate the input[type=file] (it may be hidden).` };
  }
  const input = el as HTMLInputElement;
  const transfer = new DataTransfer();
  for (const f of files) transfer.items.add(toFile(f));
  if (!input.multiple && files.length > 1) {
    return { error: 'INVALID_INPUT', message: `${label} accepts one file; ${files.length} were given.` };
  }
  input.files = transfer.files;
  fire(input, 'input');
  fire(input, 'change');
  return { label, names: files.map((f) => f.name) };
}
