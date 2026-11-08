import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip } from '@/components/ui/tooltip';
import { insertLineBreak } from './editor-dom';
import { MentionBackgrounds } from './mention-backgrounds';
import { keyAction, type KeyAction } from './keys';
import { MentionMenu, useMentionAria, useMentionMenu, type MentionSource } from './mention-menu';
import { usePlainTextEditor, type PromptBoxHandle } from './use-editor';
import { useSmoothHeight } from './use-smooth-height';

export type { PromptBoxHandle } from './use-editor';
export type { MentionSource } from './mention-menu';

const PLACEHOLDER = 'Ask opencode';
const PLACEHOLDER_HINTS = [PLACEHOLDER, 'Type / for commands and skills', 'Type @ to mention agents and files'];
const HINT_HOLD_MS = 3000;
const HINT_FADE_MS = 250;

/** Cycle the empty prompt's hints; an explicit placeholder stays fixed. */
function PromptPlaceholder({ placeholder }: { placeholder?: string }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (placeholder !== undefined) return;
    let timer: ReturnType<typeof setTimeout>;
    const hold = () => {
      timer = setTimeout(() => {
        setVisible(false);
        timer = setTimeout(() => {
          setIndex((current) => (current + 1) % PLACEHOLDER_HINTS.length);
          setVisible(true);
          hold();
        }, HINT_FADE_MS);
      }, HINT_HOLD_MS);
    };
    hold();
    return () => clearTimeout(timer);
  }, [placeholder]);
  return (
    <div aria-hidden="true" data-slot="prompt-placeholder" data-visible={placeholder !== undefined || visible}
      className="pointer-events-none absolute inset-x-0 top-0 select-none truncate px-4 pt-3 type-body text-text-tertiary transition-opacity duration-250 motion-reduce:transition-none data-[visible=false]:opacity-0">
      {placeholder ?? PLACEHOLDER_HINTS[index]}
    </div>
  );
}

type Props = {
  ref?: Ref<PromptBoxHandle>;
  placeholder?: string;
  /** A turn is running: Escape / Ctrl+G stop it. */
  working: boolean;
  /** A send waits for the models to load: the button shows a spinner. */
  held: boolean;
  /** A turn is running and the box is empty: the button is Stop. */
  stopping: boolean;
  /** Nothing can be sent right now (Send is disabled unless it is Stop). */
  disabled: boolean;
  /** Controls at the start of the toolbar (the attach menu). */
  controls?: ReactNode;
  /** Shown below the box, outside the card (the model and effort chips). */
  footer?: ReactNode;
  /** The footer folds away (smoothly) without unmounting, e.g. while a subagent's chat is open. */
  footerHidden?: boolean;
  /** Shown above the text (the attached images). */
  attachments?: ReactNode;
  /**
   * Shown inside the card in place of the editor and its toolbar (a question the agent asks).
   * The editor stays mounted, hidden, so the draft and its images are there again afterwards.
   */
  takeover?: ReactNode;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  /** Files pasted into the box (Ctrl/Cmd+V of a screenshot, copied images or files). */
  onPasteFiles?: (files: File[]) => void;
  /** What `@` and a leading `/` offer; without it, they are plain text. */
  mentions?: MentionSource;
};

/**
 * The submit button, as in opencode's composer: Send (disabled with nothing to send), a spinner
 * while a send is held for the models to load, and Stop while a turn runs with an empty box.
 * Stop wins over the spinner and stays enabled even when nothing could be sent.
 */
function SubmitButton({
  stopping,
  held,
  disabled,
  onSubmit,
  onStop,
}: Pick<Props, 'stopping' | 'held' | 'disabled' | 'onSubmit' | 'onStop'>) {
  const state = stopping ? 'stop' : held ? 'held' : 'send';
  const label = stopping ? 'Stop' : 'Send';
  const inactive = !stopping && disabled;
  return (
    <Tooltip label={label} disabled={inactive}>
      <Button
        type="button"
        size="icon"
        data-slot="submit"
        data-state={state}
        aria-label={label}
        aria-busy={state === 'held' || undefined}
        disabled={inactive}
        onClick={() => (stopping ? onStop() : onSubmit())}
      >
        {state === 'held' ? <Icon name="loader" className="animate-spin" /> : stopping ? <Icon name="stop" className="[&_path]:fill-current" /> : <Icon name="arrow-up" />}
      </Button>
    </Tooltip>
  );
}

/**
 * The row overlaid at the card's bottom: controls at the start, the submit button at the end.
 * Clicks on its empty space fall through to the editor underneath. Its bottom radius must match
 * the card's: a smaller radius lets this opaque background paint over the card's 1px shadow ring
 * at the bottom corners, making the border look cut off. `rounded-b-surface` shares the card's
 * radius token.
 */
function Toolbar(props: Pick<Props, 'controls' | 'stopping' | 'held' | 'disabled' | 'onSubmit' | 'onStop'>) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-11 items-center justify-between gap-2 rounded-b-surface bg-background px-2 pt-1 pb-2">
      <div className="pointer-events-auto flex min-w-0 items-center overflow-x-auto no-scrollbar">{props.controls}</div>
      <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
        <SubmitButton
          stopping={props.stopping}
          held={props.held}
          disabled={props.disabled}
          onSubmit={props.onSubmit}
          onStop={props.onStop}
        />
      </div>
    </div>
  );
}

/**
 * Plain-text prompt box built on a `contenteditable` div, modelled on opencode's composer. The
 * owner decides what a submit means (send or stop); this component
 * renders the editor, the submit button states and the keyboard shortcuts (see `keyAction`).
 *
 * Height: the editor is never sized from JS. It grows with its own content inside a `max-h`
 * ScrollArea viewport, so each new line lands in the same frame as the keystroke: no one-frame
 * lag, no flicker. The card follows that height (useSmoothHeight): it snaps while typing, and
 * glides when images are attached or removed and when it clears after a send, so the chat
 * above eases along with it instead of jumping. The ScrollArea scrollbar overlays the content (it takes no width),
 * so a long prompt does not rewrap as it starts to scroll. Text fades out softly at the top edge
 * and just above the toolbar (mask gradient) instead of being cut off.
 *
 * Group click is pure layout, no JS: the editor fills the whole card (bottom padding reserves the
 * toolbar row) and the toolbar is overlaid with `pointer-events: none`, so a click anywhere that is
 * not a control lands on the editor and the browser focuses it and places the caret natively.
 * The controls group opts back in with `pointer-events: auto`, so controls (even disabled ones,
 * which are `pointer-events: none` themselves) keep their clicks.
 *
 * Security: React never renders the editor's children, and the text is read back as a string
 * (never as HTML). Paste and drop are reduced to `text/plain`, and rich-text commands
 * (Ctrl+B, …) are blocked, so no markup from the clipboard or another page reaches the DOM.
 */
export function PromptBox({ ref, placeholder, ...props }: Props) {
  const { editor, text, handlers } = usePlainTextEditor(ref, props.onChange, props.onPasteFiles);
  const card = useSmoothHeight<HTMLDivElement, HTMLDivElement, HTMLDivElement>();
  const menu = useMentionMenu(editor, props.mentions);
  const aria = useMentionAria(menu.view);
  const editorFrame = useRef<HTMLDivElement>(null);
  const [hintPosition, setHintPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const frame = editorFrame.current;
    const anchor = menu.hintAnchor;
    if (!frame || !anchor) {
      setHintPosition(null);
      return;
    }
    const measure = () => {
      const trigger = anchor.getBoundingClientRect();
      const bounds = frame.getBoundingClientRect();
      setHintPosition({ left: trigger.right - bounds.left, top: trigger.top - bounds.top });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [menu.hintAnchor]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // An open `@` / `/` list takes the arrows, Enter, Tab and Escape first.
    if (menu.onKeyDown(event)) return;
    const { key, ctrlKey, metaKey, altKey, shiftKey, repeat, keyCode } = event;
    const info = { key, ctrlKey, metaKey, altKey, shiftKey, repeat, keyCode, isComposing: event.nativeEvent.isComposing };
    const action = keyAction(info, { stoppable: props.working || props.held });
    if (action === null) return;
    event.preventDefault();
    const run: Partial<Record<NonNullable<KeyAction>, () => void>> = {
      stop: props.onStop,
      newline: () => insertLineBreak(event.currentTarget),
      submit: props.onSubmit,
    };
    run[action]?.();
  };

  return (
    <div className="px-3 pb-3 pt-1">
      {/* Notion-style surface: no CSS border (the 1px hairline is the first shadow layer).
          Elevation tokens live in global.css: rest -> hover -> focus. Hover only applies while
          the box is not focused, so moving the mouse never weakens the focused lift. The card
          glides to its content's height (useSmoothHeight); the motion and the bottom-pinned,
          clipped content live in global.css under [data-slot="prompt-box"]. */}
      <div
        ref={card.outer}
        data-slot="prompt-box"
        className="group/prompt-box relative rounded-surface bg-background shadow-surface-rest hover:not-focus-within:shadow-surface-hover focus-within:shadow-surface-focus"
      >
        <div ref={card.inner} className="shrink-0">
          {props.takeover}
          <div hidden={!!props.takeover}>
            {props.attachments}
            <div ref={card.steady}>
              <ScrollArea
                fade
                className="rounded-surface [--fade-top-max:2rem] [--fade-bottom-max:3rem] [--fade-bottom-inset:2.5rem]"
                viewportClassName="max-h-70 overscroll-contain scroll-pt-3 scroll-pb-10"
                scrollbarClassName="top-3! bottom-12! h-auto!"
              >
                <div ref={editorFrame} className="relative">
                  <MentionBackgrounds editor={editor} text={text} agents={props.mentions?.catalog.agents} />
                  <div
                    ref={editor}
                    role="textbox"
                    aria-label="Message"
                    aria-multiline="true"
                    aria-placeholder={placeholder ?? PLACEHOLDER}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck
                    dir="auto"
                    autoCapitalize="sentences"
                    className="relative block min-h-24 w-full whitespace-pre-wrap break-words px-4 pt-3 pb-11 type-body text-text-primary caret-text-primary outline-none [unicode-bidi:plaintext]"
                    onKeyDown={onKeyDown}
                    {...aria.editorProps}
                    {...handlers}
                    onInput={() => {
                      handlers.onInput();
                      menu.refresh();
                    }}
                  />
                  {text === '' && <PromptPlaceholder placeholder={placeholder} />}
                  {menu.hintAnchor && hintPosition && (
                    <span aria-hidden="true" data-slot="mention-hint" className="pointer-events-none absolute select-none whitespace-nowrap type-body text-text-tertiary" style={hintPosition}>
                      Type to filter
                    </span>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
        {!props.takeover && <Toolbar {...props} />}
      </div>
      {props.mentions && <MentionMenu view={menu.view} actions={menu.actions} listID={aria.listID} editor={editor} />}
      {props.footer && (
        <div data-slot="prompt-box-footer" data-hidden={props.footerHidden ? '' : undefined} inert={props.footerHidden}>
          <div className="min-h-0 overflow-hidden">
            <div className="flex min-w-0 items-center px-1.5 pt-1.5">{props.footer}</div>
          </div>
        </div>
      )}
    </div>
  );
}
