import { useImperativeHandle, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type Ref } from 'react';
import { isFileDrag, pastedFiles } from '@/lib/transfer-files';
import type { MentionItem, MentionKind, PlacedMention } from '@/lib/opencode/mentions';
import { caretToEnd, insertChip, insertPlainText, placeCaretAt, readChips, readText } from './editor-dom';

export type PromptBoxHandle = {
  /** Replaces the draft (reported through `onChange`), optionally focusing with the caret at the end. */
  setText: (text: string, options?: { focus?: boolean }) => void;
  focus: () => void;
  /** Where the text's first line starts on screen (for the send flight); null with no editor. */
  textOrigin: () => { left: number; top: number } | null;
  /** The chips in the draft (agents, skills, files, a command), with their offsets in its text. */
  mentions: () => PlacedMention[];
  /** Puts a chip at the caret (at the end when the editor is not focused) and focuses the editor. */
  insertMention: (item: MentionItem) => void;
};

/** The top-left of the editor's text, kept inside its scroll viewport when the text is scrolled. */
function textOrigin(el: HTMLElement): { left: number; top: number } {
  const box = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const origin = { left: box.left + (parseFloat(style.paddingLeft) || 0), top: box.top + (parseFloat(style.paddingTop) || 0) };
  const viewport = (el.closest('[data-slot="scroll-area-viewport"]') ?? el.parentElement)?.getBoundingClientRect();
  if (viewport && origin.top < viewport.top) origin.top = viewport.top + (parseFloat(style.paddingTop) || 0);
  return origin;
}

const focusEnd = (el: HTMLElement) => {
  el.focus();
  caretToEnd(el);
};

/**
 * The plain-text `contenteditable` editor: reads it back as a string, exposes `setText`/`focus`
 * through `ref`, and reduces paste and drop to `text/plain` while blocking rich-text commands.
 */
export function usePlainTextEditor(
  ref: Ref<PromptBoxHandle> | undefined,
  onChange: (text: string) => void,
  /** Files pasted into the editor (a screenshot, copied images or files); absent, a paste is text only. */
  onPasteFiles?: (files: File[]) => void,
) {
  const editor = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');

  const report = (value: string) => {
    setText(value);
    onChange(value);
  };

  useImperativeHandle(ref, () => ({
    setText: (value, options) => {
      const el = editor.current;
      if (!el) return;
      el.replaceChildren(...(value ? [document.createTextNode(value)] : []));
      report(value);
      if (options?.focus) focusEnd(el);
    },
    focus: () => {
      if (editor.current) focusEnd(editor.current);
    },
    textOrigin: () => (editor.current ? textOrigin(editor.current) : null),
    mentions: () =>
      editor.current
        ? readChips(editor.current).map(({ kind, name, path, label, start, end }) => ({ kind: kind as MentionKind, name, path, start, end, text: label }))
        : [],
    insertMention: (item) => {
      if (editor.current) insertChip(editor.current, { kind: item.kind, name: item.name, label: item.label, path: item.path });
    },
  }));

  const onInput = () => {
    const el = editor.current;
    if (!el) return;
    const value = readText(el);
    // Deleting everything leaves stray `<br>`s behind; drop them so the placeholder and caret reset.
    if (!value.trim() && !value.includes('\n') && el.firstChild) el.replaceChildren();
    report(value);
  };

  const onBeforeInput = (event: FormEvent<HTMLDivElement>) => {
    // Block bold/italic/etc. and any rich insertion the paste/drop handlers did not normalise.
    const type = (event.nativeEvent as InputEvent).inputType ?? '';
    if (type.startsWith('format') || type === 'insertFromPasteAsQuotation') event.preventDefault();
  };

  // Ctrl+V and Cmd+V both arrive here as the same `paste` event, so no key handling is needed.
  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = onPasteFiles ? pastedFiles(event.clipboardData) : [];
    if (files.length) return void onPasteFiles?.(files);
    insertPlainText(event.currentTarget, event.clipboardData.getData('text/plain'));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    // Dropped files belong to the pane's drop zone (useFileDrop); a file's path or name, which
    // Finder and some file managers add as text, must not land in the message as well.
    if (isFileDrag(event.dataTransfer)) return;
    const value = event.dataTransfer.getData('text/plain');
    if (!value) return;
    const target = event.currentTarget;
    target.focus();
    placeCaretAt(event.clientX, event.clientY, target);
    insertPlainText(target, value);
  };

  return { editor, text, handlers: { onInput, onBeforeInput, onPaste, onDrop } };
}
