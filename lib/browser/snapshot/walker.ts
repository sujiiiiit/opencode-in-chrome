// The page walker (spec browser/page-snapshot, design D5). It runs inside each frame, in the
// extension's isolated world, and turns the DOM into compact lines:
//   role "name" [@n] attr="value" (state)
// `@n` is the element's local number in this document's registry; the service worker
// rewrites it to a tab-wide ref like `e57`. Iframes end with `{iframe:<url>}` (the URL the
// frame loads, URI-encoded) so the worker can match each child frame to its iframe line and
// stitch it in place (Chromium has no runtime.getFrameId). Pure DOM code: no extension APIs.

export type WalkFilter = 'interactive' | 'all';

export type WalkOptions = {
  filter?: WalkFilter;
  /** Max depth of kept elements (default 15). */
  depth?: number;
  /** Only this element (a local number) and its descendants. */
  rootRef?: number;
  maxNodes?: number;
  timeBudgetMs?: number;
  /** The element's shadow root, open or closed (chrome.dom.openOrClosedShadowRoot). */
  shadowRootOf?: (el: Element) => ShadowRoot | null;
  now?: () => number;
};

/** A line's element box: top and height in CSS px, relative to its own frame's viewport; null when it has no box. */
export type LineBox = [top: number, height: number] | null;

export type WalkResult = {
  lines: string[];
  /** One per line: where the element is, for the viewport window (design D5). */
  boxes: LineBox[];
  capped: boolean;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  title: string;
  url: string;
};

const NAME_MAX = 100;
const VALUE_MAX = 100;
const HREF_MAX = 150;
const DEFAULT_MAX_NODES = 5000;
const DEFAULT_TIME_MS = 150;

/** Stable local numbers for this document's elements (weakly held, never reused). */
export class ElementRegistry {
  private next = 1;
  private readonly ids = new WeakMap<Element, number>();
  private readonly refs = new Map<number, WeakRef<Element>>();

  idOf(el: Element): number {
    let id = this.ids.get(el);
    if (id === undefined) {
      id = this.next++;
      this.ids.set(el, id);
      this.refs.set(id, new WeakRef(el));
    }
    return id;
  }

  /** The element, if it is still in the document. */
  get(id: number): Element | undefined {
    const el = this.refs.get(id)?.deref();
    if (!el || !el.isConnected) return undefined;
    return el;
  }
}

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'tab',
  'switch', 'combobox', 'textbox', 'searchbox', 'slider', 'spinbutton', 'treeitem', 'listbox', 'gridcell',
]);
const SEMANTIC_ROLES = new Set([
  'heading', 'img', 'list', 'listitem', 'table', 'row', 'cell', 'columnheader', 'rowheader', 'form', 'group',
  'dialog', 'alertdialog', 'navigation', 'main', 'banner', 'contentinfo', 'complementary', 'region', 'search',
  'article', 'alert', 'status', 'tablist', 'tabpanel', 'menu', 'menubar', 'toolbar', 'tree', 'grid', 'paragraph',
  'label', 'iframe',
]);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK', 'HEAD', 'SVG', 'PATH', 'BR', 'HR']);
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password', '']);

const clean = (text: string | null | undefined, max = NAME_MAX): string => {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
};

function inputRole(input: HTMLInputElement): string {
  return INPUT_ROLES[input.type] ?? 'textbox';
}

const INPUT_ROLES: Record<string, string> = {
  checkbox: 'checkbox', radio: 'radio', button: 'button', submit: 'button', reset: 'button', image: 'button',
  range: 'slider', number: 'spinbutton', search: 'searchbox', file: 'button',
};

export function roleOf(el: Element): string {
  const explicit = el.getAttribute('role')?.split(/\s+/)[0];
  if (explicit && explicit !== 'presentation' && explicit !== 'none') return explicit;
  return specialRole(el) ?? TAG_ROLES[el.tagName] ?? 'generic';
}

function specialRole(el: Element): string | undefined {
  if (el.tagName === 'A' || el.tagName === 'AREA') return el.hasAttribute('href') ? 'link' : 'generic';
  if (el.tagName === 'INPUT') return inputRole(el as HTMLInputElement);
  if (el.tagName === 'SELECT') return selectRole(el as HTMLSelectElement);
  if (el.tagName === 'IMG') return el.getAttribute('alt') === '' ? 'presentation' : 'img';
  if (isEditable(el)) return 'textbox';
  return undefined;
}

function selectRole(select: HTMLSelectElement): string {
  return select.multiple || select.size > 1 ? 'listbox' : 'combobox';
}

function isEditable(el: Element): boolean {
  return (el as HTMLElement).isContentEditable && el.getAttribute('contenteditable') !== null;
}

const TAG_ROLES: Record<string, string> = {
  BUTTON: 'button', SUMMARY: 'button', TEXTAREA: 'textbox', OPTION: 'option',
  H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', H5: 'heading', H6: 'heading',
  UL: 'list', OL: 'list', LI: 'listitem', TABLE: 'table', TR: 'row', TD: 'cell', TH: 'columnheader',
  FORM: 'form', FIELDSET: 'group', DIALOG: 'dialog', NAV: 'navigation', MAIN: 'main',
  HEADER: 'banner', FOOTER: 'contentinfo', ASIDE: 'complementary', ARTICLE: 'article',
  P: 'paragraph', LABEL: 'label', IFRAME: 'iframe', FRAME: 'iframe',
};

function textOf(el: Element, exclude?: Element): string {
  let out = '';
  const visit = (node: Node) => {
    if (node === exclude) return;
    if (node.nodeType === 3) out += node.textContent ?? '';
    else if (node.nodeType === 1 && !SKIP_TAGS.has((node as Element).tagName)) node.childNodes.forEach(visit);
  };
  el.childNodes.forEach(visit);
  return out;
}

function labelText(control: Element): string {
  const labels = (control as HTMLInputElement).labels;
  if (labels && labels.length) return clean(Array.from(labels, (l) => textOf(l, control)).join(' '));
  const wrapping = control.closest('label');
  return wrapping ? clean(textOf(wrapping, control)) : '';
}

/** An approximation of the accessible name, plus useful fallbacks (placeholder, title). */
export function nameOf(el: Element, role: string): string {
  const labelled = labelledName(el);
  if (labelled) return labelled;
  const aria = clean(el.getAttribute('aria-label'));
  if (aria) return aria;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return controlName(el);
  return nonControlName(el, role);
}

function nonControlName(el: Element, role: string): string {
  const tag = el.tagName;
  if (tag === 'IMG') return firstName(el.getAttribute('alt'), el.getAttribute('title'));
  if (FRAME_TAGS.has(tag)) return firstName(el.getAttribute('title'), el.getAttribute('name'));
  if (tag === 'FIELDSET') return clean(el.querySelector(':scope > legend')?.textContent);
  if (OWN_TEXT_ROLES.has(role)) return clean(ownText(el));
  if (INTERACTIVE_ROLES.has(role) || NAMED_ROLES.has(role)) {
    return firstName(textOf(el), el.getAttribute('title'));
  }
  return clean(el.getAttribute('title'));
}

const NAMED_ROLES = new Set(['heading', 'listitem', 'cell', 'columnheader', 'dialog']);
const OWN_TEXT_ROLES = new Set(['generic', 'paragraph', 'label']);
const FRAME_TAGS = new Set(['IFRAME', 'FRAME']);

function firstName(...values: Array<string | null>): string {
  return values.map((value) => clean(value)).find(Boolean) ?? '';
}

function labelledName(el: Element): string {
  const ids = el.getAttribute('aria-labelledby');
  if (!ids) return '';
  const doc = el.ownerDocument;
  return clean(ids.split(/\s+/).map((id) => textOf(doc.getElementById(id) ?? doc.createElement('i'))).join(' '));
}

function controlName(el: Element): string {
  const input = el as HTMLInputElement;
  if (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(input.type)) return firstName(input.value, input.type);
  if (el.tagName === 'INPUT' && input.type === 'image') return firstName(input.alt, 'image');
  return firstName(labelText(el), el.getAttribute('placeholder'), el.getAttribute('title'), adjacentText(input), input.name);
}

const INLINE_LABELS = new Set(['SPAN', 'B', 'I', 'EM', 'STRONG', 'SMALL']);

/** The text next to a field that has no label: after a checkbox or radio, before any other field. */
function adjacentText(input: HTMLInputElement): string {
  const choice = input.type === 'checkbox' || input.type === 'radio';
  const sides = choice ? [input.nextSibling, input.previousSibling] : [input.previousSibling];
  for (const node of sides) {
    const text = shortText(node);
    if (text) return text;
  }
  return '';
}

function shortText(node: Node | null): string {
  if (!node || (node.nodeType !== 3 && !INLINE_LABELS.has((node as Element).tagName))) return '';
  const text = clean(node.textContent);
  return text.length <= 60 ? text : '';
}

function ownText(el: Element): string {
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.textContent ?? '';
  });
  return out;
}

function isHidden(el: Element): boolean {
  if ((el as HTMLElement).hidden) return true;
  if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'hidden') return true;
  const view = el.ownerDocument.defaultView;
  const style = view?.getComputedStyle(el);
  if (!style) return false;
  return style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse';
}

function isInteractive(el: Element, role: string): boolean {
  if (INTERACTIVE_ROLES.has(role)) return true;
  if (el.tagName === 'SUMMARY' || el.tagName === 'IFRAME') return true;
  if (el.hasAttribute('onclick')) return true;
  const tabindex = el.getAttribute('tabindex');
  if (tabindex !== null && Number(tabindex) >= 0) return true;
  return (el as HTMLElement).isContentEditable && el.getAttribute('contenteditable') !== null;
}

function states(el: Element, role: string, doc: Document): string[] {
  const out: string[] = [];
  if (CHECKED_ROLES.has(role) && ((el as HTMLInputElement).checked || el.getAttribute('aria-checked') === 'true')) out.push('checked');
  out.push(...ariaStates(el));
  out.push(...controlStates(el));
  if (doc.activeElement === el || shadowActive(doc) === el) out.push('focused');
  return out;
}

const CHECKED_ROLES = new Set(['checkbox', 'radio', 'switch', 'menuitemcheckbox', 'menuitemradio']);

function ariaStates(el: Element): string[] {
  const out: string[] = [];
  if (el.getAttribute('aria-selected') === 'true') out.push('selected');
  if (el.getAttribute('aria-pressed') === 'true') out.push('pressed');
  const expanded = el.getAttribute('aria-expanded');
  if (expanded === 'true') out.push('expanded');
  else if (expanded === 'false') out.push('collapsed');
  if (el.tagName === 'DETAILS') out.push((el as HTMLDetailsElement).open ? 'expanded' : 'collapsed');
  return out;
}

function controlStates(el: Element): string[] {
  const out: string[] = [];
  const h = el as HTMLInputElement;
  if (h.disabled || el.getAttribute('aria-disabled') === 'true') out.push('disabled');
  if (h.required || el.getAttribute('aria-required') === 'true') out.push('required');
  if (h.readOnly || el.getAttribute('aria-readonly') === 'true') out.push('readonly');
  return out;
}

function shadowActive(doc: Document): Element | null {
  let active: Element | null = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

function attrs(el: Element, role: string): string[] {
  const out: string[] = [];
  if (role === 'link') out.push(`href=${JSON.stringify(clean(el.getAttribute('href') ?? '', HREF_MAX))}`);
  if (el.tagName === 'INPUT') return [...out, ...inputAttrs(el as HTMLInputElement)];
  return [...out, ...valueAttrs(el, role), ...structuralAttrs(el, role)];
}

function valueAttrs(el: Element, role: string): string[] {
  if (el.tagName === 'TEXTAREA') {
    const value = (el as HTMLTextAreaElement).value;
    return value ? [`value=${JSON.stringify(clean(value, VALUE_MAX))}`] : [];
  }
  if (el.tagName === 'SELECT') {
    return selectedValue(el as HTMLSelectElement);
  }
  if (el.tagName === 'OPTION') return [`value=${JSON.stringify(clean((el as HTMLOptionElement).value, VALUE_MAX))}`];
  if (role !== 'textbox' || !(el as HTMLElement).isContentEditable) return [];
  const text = clean(el.textContent, VALUE_MAX);
  return text ? [`value=${JSON.stringify(text)}`] : [];
}

function selectedValue(select: HTMLSelectElement): string[] {
  const picked = Array.from(select.selectedOptions ?? [], (o) => clean(o.textContent));
  return picked.length ? [`value=${JSON.stringify(picked.join(', '))}`] : [];
}

function structuralAttrs(el: Element, role: string): string[] {
  if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
    const src = el.getAttribute('src');
    return src ? [`src=${JSON.stringify(clean(src, HREF_MAX))}`] : [];
  }
  if (role !== 'heading') return [];
  const level = /^H(\d)$/.exec(el.tagName)?.[1] ?? el.getAttribute('aria-level');
  return level ? [`level=${level}`] : [];
}

function inputAttrs(input: HTMLInputElement): string[] {
  const out: string[] = [];
  const type = input.type;
  if (!['text', 'checkbox', 'radio', 'submit', 'button'].includes(type)) out.push(`type="${type}"`);
  const value = inputValueAttr(input);
  if (value) out.push(value);
  if (type === 'file' && input.files?.length) out.push(`files=${input.files.length}`);
  return out;
}

function inputValueAttr(input: HTMLInputElement): string | undefined {
  const type = input.type;
  if (!TEXT_INPUT_TYPES.has(type) && !['date', 'time', 'datetime-local', 'month', 'week', 'color', 'range'].includes(type)) return undefined;
  if (!input.value) return undefined;
  return type === 'password' ? 'value=\u2022\u2022\u2022' : `value=${JSON.stringify(clean(input.value, VALUE_MAX))}`;
}

function offscreen(el: Element, view: Window | null): boolean {
  if (!view) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return rect.bottom < 0 || rect.right < 0 || rect.top > view.innerHeight || rect.left > view.innerWidth;
}

/** The element's box in its frame's viewport; null for elements without one (display: contents, zero size). */
function boxOf(el: Element): LineBox {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return [Math.round(rect.top), Math.round(rect.height)];
}

/** The URL an iframe's frame reports (webNavigation's `url`): srcdoc and blank frames included. */
function frameUrl(el: Element): string {
  if (el.hasAttribute('srcdoc')) return 'about:srcdoc';
  const src = (el as HTMLIFrameElement).src;
  return src || 'about:blank';
}

/** The children to walk: the shadow tree when there is one, slots flattened. */
function childrenOf(el: Element | ShadowRoot | Document, shadowRootOf?: (el: Element) => ShadowRoot | null): Node[] {
  if (el.nodeType === 1) return elementChildren(el as Element, shadowRootOf);
  return Array.from(el.childNodes);
}

function elementChildren(el: Element, shadowRootOf?: (el: Element) => ShadowRoot | null): Node[] {
  const shadow = el.shadowRoot ?? shadowRootOf?.(el) ?? null;
  if (shadow) return Array.from(shadow.childNodes);
  if (el.tagName === 'SLOT') {
    const assigned = (el as HTMLSlotElement).assignedNodes?.({ flatten: true }) ?? [];
    if (assigned.length) return assigned;
  }
  return Array.from(el.childNodes);
}

type WalkState = {
  doc: Document;
  registry: ElementRegistry;
  filter: WalkFilter;
  maxDepth: number;
  maxNodes: number;
  now: () => number;
  deadline: number;
  view: Window | null;
  shadowRootOf?: (el: Element) => ShadowRoot | null;
  lines: string[];
  boxes: LineBox[];
  capped: boolean;
  visited: number;
};

/** A rich-text frame (TinyMCE, CKEditor, ...) is a body that is itself the editable field. */
function isEditableBody(root: Element): boolean {
  const editable = root.getAttribute('contenteditable');
  return root.tagName === 'BODY' && editable !== null && editable !== 'false';
}

export function walk(doc: Document, registry: ElementRegistry, options: WalkOptions = {}): WalkResult {
  const state = makeWalkState(doc, registry, options);
  const root = options.rootRef !== undefined ? registry.get(options.rootRef) : doc.body ?? doc.documentElement;
  if (root) {
    const nodes = options.rootRef !== undefined || isEditableBody(root) ? [root] : childrenOf(root, options.shadowRootOf);
    for (const node of nodes) visitNode(state, node, 0);
  }
  return {
    lines: state.lines,
    boxes: state.boxes,
    capped: state.capped,
    viewport: {
      width: state.view?.innerWidth ?? 0,
      height: state.view?.innerHeight ?? 0,
      scrollX: Math.round(state.view?.scrollX ?? 0),
      scrollY: Math.round(state.view?.scrollY ?? 0),
    },
    title: doc.title,
    url: doc.location?.href ?? '',
  };
}

function makeWalkState(doc: Document, registry: ElementRegistry, options: WalkOptions): WalkState {
  const now = options.now ?? (() => performance.now());
  return {
    doc, registry, now,
    filter: options.filter ?? 'interactive',
    maxDepth: options.depth ?? 15,
    maxNodes: options.maxNodes ?? DEFAULT_MAX_NODES,
    deadline: now() + (options.timeBudgetMs ?? DEFAULT_TIME_MS),
    view: doc.defaultView,
    shadowRootOf: options.shadowRootOf,
    lines: [], boxes: [], capped: false, visited: 0,
  };
}

function visitNode(state: WalkState, node: Node, depth: number): void {
  const el = walkableElement(state, node);
  if (!el) return;
  const role = roleOf(el);
  const hidden = isHidden(el);
  if (hidden && state.filter === 'interactive') return;
  const interactive = isInteractive(el, role);
  const name = nameOf(el, role);
  const rendered = renderNode(state, el, role, name, interactive, hidden, depth);
  if (rendered.stop || el.tagName === 'IFRAME' || el.tagName === 'FRAME') return;
  for (const child of childrenOf(el, state.shadowRootOf)) visitNode(state, child, rendered.depth);
}

function walkableElement(state: WalkState, node: Node): Element | undefined {
  if (state.capped || node.nodeType !== 1) return undefined;
  const el = node as Element;
  return skipElement(el) || timeExceeded(state) ? undefined : el;
}

function timeExceeded(state: WalkState): boolean {
  if (++state.visited % 200 !== 0 || state.now() <= state.deadline) return false;
  state.capped = true;
  return true;
}

function renderNode(state: WalkState, el: Element, role: string, name: string, interactive: boolean, hidden: boolean, depth: number): { depth: number; stop: boolean } {
  if (!shouldKeep(role, interactive, state.filter, name, hidden) || depth >= state.maxDepth) return { depth, stop: false };
  if (state.lines.length >= state.maxNodes) {
    state.capped = true;
    return { depth, stop: true };
  }
  state.lines.push(' '.repeat(depth) + elementLine(el, role, name, interactive, hidden, state.doc, state.view, state.registry));
  const box = hidden ? null : boxOf(el);
  state.boxes.push(box);
  const childDepth = depth + 1;
  if (hidden) return { depth: childDepth, stop: true };
  if (el.tagName === 'SELECT') {
    const before = state.lines.length;
    appendOptions(el as HTMLSelectElement, childDepth, state.lines);
    for (let i = before; i < state.lines.length; i++) state.boxes.push(box);
    return { depth: childDepth, stop: true };
  }
  return { depth: childDepth, stop: false };
}

function skipElement(el: Element): boolean {
  return SKIP_TAGS.has(el.tagName.toUpperCase());
}

function shouldKeep(role: string, interactive: boolean, filter: WalkFilter, name: string, hidden: boolean): boolean {
  if (role === 'presentation') return false;
  if (interactive) return true;
  return filter === 'all' && (SEMANTIC_ROLES.has(role) || (role === 'generic' && name !== '') || hidden);
}

function elementLine(el: Element, role: string, name: string, interactive: boolean, hidden: boolean, doc: Document, view: Window | null, registry: ElementRegistry): string {
  const parts = [role];
  if (name) parts.push(JSON.stringify(name));
  if (interactive || role === 'iframe') parts.push(`[@${registry.idOf(el)}]`);
  parts.push(...attrs(el, role));
  const st = states(el, role, doc);
  if (hidden) st.push('hidden');
  else if (interactive && offscreen(el, view)) st.push('offscreen');
  if (st.length) parts.push(`(${st.join(', ')})`);
  if (role === 'iframe') parts.push(`{iframe:${encodeURIComponent(frameUrl(el))}}`);
  return parts.join(' ');
}

function appendOptions(select: HTMLSelectElement, depth: number, lines: string[]): void {
  for (const option of Array.from(select.options)) {
    const selected = option.selected ? ' (selected)' : '';
    lines.push(' '.repeat(depth) + `option ${JSON.stringify(clean(option.textContent))} value=${JSON.stringify(clean(option.value))}${selected}`);
  }
}

/** The readable main content of the page as plain text (for get_page_text). */
export function pageText(doc: Document): { title: string; url: string; source: string; text: string } {
  const main =
    doc.querySelector('main, [role="main"]') ??
    (doc.querySelectorAll('article').length === 1 ? doc.querySelector('article') : null) ??
    doc.body;
  const source = main ? `<${main.tagName.toLowerCase()}>` : '<none>';
  const raw = main ? ((main as HTMLElement).innerText ?? main.textContent ?? '') : '';
  const text = raw
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== ''))
    .join('\n')
    .trim();
  return { title: doc.title, url: doc.location?.href ?? '', source, text };
}
