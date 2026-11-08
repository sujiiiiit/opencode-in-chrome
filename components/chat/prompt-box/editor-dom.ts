/** DOM helpers for the prompt box's plain-text `contenteditable` editor. */

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI']);

/** Reads the editor as plain text. Browsers mark line breaks with `<br>` or wrap lines in `<div>`s. */
export function readText(root: Node): string {
  let out = '';
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.nodeValue ?? '';
      } else if (child.nodeName === 'BR') {
        out += '\n';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (BLOCK_TAGS.has(child.nodeName) && out && !out.endsWith('\n')) out += '\n';
        walk(child);
      }
    }
  };
  walk(root);
  // A trailing `<br>` only makes the last empty line visible; it is not content.
  return lastContent(root)?.nodeName === 'BR' ? out.slice(0, -1) : out;
}

/** The last child that is not an empty text node (deleting a chip leaves those after Chrome's `<br>`). */
function lastContent(root: Node): Node | null {
  let node = root.lastChild;
  while (node?.nodeType === Node.TEXT_NODE && !node.nodeValue) node = node.previousSibling;
  return node;
}

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * Inserts text at the caret through the browser's editing pipeline, so undo and the `input`
 * event keep working. Multiline text goes in as one escaped `insertHTML` (a single text node
 * rendered by `pre-wrap`) because `insertText` splits it into one `<div>` per line.
 */
export function insertPlainText(target: HTMLElement, raw: string) {
  const value = raw.replace(/\r\n?/g, '\n');
  if (!value) return;
  const multiline = value.includes('\n');
  if (typeof document.execCommand === 'function') {
    const ok = multiline
      ? document.execCommand('insertHTML', false, escapeHtml(value))
      : document.execCommand('insertText', false, value);
    if (ok) return;
  }
  insertNodeAtCaret(target, document.createTextNode(value));
}

export function insertLineBreak(target: HTMLElement) {
  if (typeof document.execCommand === 'function' && document.execCommand('insertLineBreak')) return;
  insertNodeAtCaret(target, document.createElement('br'));
}

/** Fallback for engines without `execCommand`: insert a node at the caret and announce it. */
function insertNodeAtCaret(target: HTMLElement, node: Node) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !target.contains(selection.anchorNode)) {
    target.append(node);
  } else {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

// ─── Mention chips ─────────────────────────────────────────────────────────

/** What a chip carries; its text (`@explore`, `/review`) is the label. */
export type ChipData = { kind: string; name: string; label: string; path?: string };

const CHIP_SELECTOR = 'span[data-mention]';

/**
 * A mention as an atomic, non-editable chip: Backspace removes it whole, and `readText` reads its
 * label like any other text, so offsets in the text line up with the chips. Styled in global.css.
 * The label is set as text (never HTML), so a server-supplied name cannot inject markup.
 */
function createChip(data: ChipData): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset.mention = data.kind;
  chip.dataset.name = data.name;
  if (data.path) chip.dataset.path = data.path;
  chip.dir = 'auto';
  if ((data.kind === 'agent' && data.label.startsWith('@')) || (data.kind === 'skill' && data.label.startsWith('/'))) {
    const prefix = document.createElement('span');
    prefix.dataset.mentionPrefix = '';
    prefix.append(document.createTextNode(data.label[0]!));
    const icon = document.createElement('span');
    icon.dataset.mentionIcon = '';
    icon.setAttribute('aria-hidden', 'true');
    prefix.append(icon);
    chip.append(prefix, document.createTextNode(data.label.slice(1)));
  } else {
    chip.textContent = data.label;
  }
  return chip;
}

/** Places the caret right after `node`. */
function caretAfter(node: Node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Inserts a chip followed by a space. `replace` is the typed trigger (`@que`) to swap for it;
 * otherwise the chip goes at the caret, or at the end when the caret is outside the editor.
 * Announced with an `input` event, as typing would be.
 */
export function insertChip(root: HTMLElement, data: ChipData, replace?: Range) {
  const selection = window.getSelection();
  let range = replace;
  if (!range) {
    const caret = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (caret && root.contains(caret.startContainer)) {
      range = caret;
    } else {
      range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
    }
  }
  range.deleteContents();
  const chip = createChip(data);
  const space = document.createTextNode(' ');
  range.insertNode(space);
  range.insertNode(chip);
  // A stray trailing `<br>` (left by an emptied line) would push the caret onto a new line.
  if (space.nextSibling?.nodeName === 'BR' && !space.nextSibling.nextSibling) space.nextSibling.remove();
  root.focus();
  caretAfter(space);
  root.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * The length of `readText`'s text up to a point inside `root` (`stopNode` and `stopOffset`, as a
 * Range boundary), or null when the point is outside it. The text before the point is cloned and
 * read the same way; a `<br>` ending the clone is a real line break there, not the editor's last.
 */
function textUpTo(root: Node, stopNode: Node, stopOffset: number): number | null {
  if (!root.contains(stopNode)) return null;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(stopNode, stopOffset);
  const before = range.cloneContents();
  return readText(before).length + (before.lastChild?.nodeName === 'BR' ? 1 : 0);
}

/** True when `node` has visible content (text or a line break) before it inside `root`. */
function hasContentBefore(root: Node, node: Node): boolean {
  for (let at: Node | null = node; at && at !== root; at = at.parentNode) {
    for (let prev = at.previousSibling; prev; prev = prev.previousSibling) {
      if (prev.nodeType === Node.TEXT_NODE ? prev.nodeValue : prev.nodeName === 'BR' || prev.hasChildNodes()) return true;
    }
  }
  return false;
}

/**
 * True when the text right before `node` ends a word: the start of a line, a line break, or
 * whitespace. A chip right before it does not (`@explore@` is not a new mention).
 */
function breakBefore(node: Node): boolean {
  let prev = node.previousSibling;
  while (prev && prev.nodeType === Node.TEXT_NODE && !prev.nodeValue) prev = prev.previousSibling;
  if (!prev) return true;
  if (prev.nodeName === 'BR' || BLOCK_TAGS.has(prev.nodeName)) return true;
  return prev.nodeType === Node.TEXT_NODE && /\s$/.test(prev.nodeValue ?? '');
}

/**
 * The word being typed at the caret (from the last whitespace in the caret's text node up to the
 * caret), when the caret is collapsed in a text node of `root`. `afterBreak`: a word break comes
 * before it; `atStart`: nothing comes before it in the whole draft. It reads only the caret's own
 * text node and its neighbours, never the whole draft, so it stays cheap on every caret move.
 */
export function caretWord(root: HTMLElement): { word: string; node: Text; start: number; end: number; afterBreak: boolean; atStart: boolean } | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return null;
  const { startContainer: node, startOffset: end } = selection.getRangeAt(0);
  if (node.nodeType !== Node.TEXT_NODE || !root.contains(node) || node.parentElement?.closest(CHIP_SELECTOR)) return null;
  const text = (node as Text).data.slice(0, end);
  const start = /\S*$/.exec(text)!.index;
  const atStart = start === 0 && !hasContentBefore(root, node);
  const afterBreak = start > 0 || atStart || breakBefore(node);
  return { word: text.slice(start), node: node as Text, start, end, afterBreak, atStart };
}

/** The chips in the editor, with their offsets in `readText`'s text. */
export function readChips(root: HTMLElement): Array<ChipData & { start: number; end: number }> {
  return Array.from(root.querySelectorAll<HTMLSpanElement>(CHIP_SELECTOR)).flatMap((chip) => {
    const parent = chip.parentNode;
    if (!parent) return [];
    const start = textUpTo(root, parent, Array.from(parent.childNodes).indexOf(chip));
    const label = chip.textContent ?? '';
    const { mention: kind, name, path } = chip.dataset;
    if (start === null || !kind || !name) return [];
    return [{ kind, name, label, path, start, end: start + label.length }];
  });
}

export function caretToEnd(el: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function placeCaretAt(x: number, y: number, el: HTMLElement) {
  const range = document.caretRangeFromPoint?.(x, y);
  if (!range || !el.contains(range.startContainer)) return caretToEnd(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
