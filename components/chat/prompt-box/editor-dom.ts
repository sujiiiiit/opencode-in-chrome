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
  return root.lastChild?.nodeName === 'BR' ? out.slice(0, -1) : out;
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
