/** What a keydown in the prompt box means, following opencode's composer shortcuts. */
export type KeyAction = 'stop' | 'newline' | 'submit' | 'ignore' | null;

type Key = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat' | 'isComposing' | 'keyCode'>;

const isCtrlG = (e: Key) => e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'g';
const isStopKey = (e: Key) => e.key === 'Escape' || isCtrlG(e);
// keyCode 229: some IMEs report the composing Enter this way without setting isComposing.
const isComposing = (e: Key) => e.isComposing || e.keyCode === 229;

/**
 * Escape or Ctrl+G stop a running turn or a held send; Enter submits and Shift+Enter inserts a
 * line break. A held-down Enter is swallowed so it cannot send twice.
 */
export function keyAction(e: Key, state: { stoppable: boolean }): KeyAction {
  if (state.stoppable && isStopKey(e)) return 'stop';
  if (e.key !== 'Enter' || isComposing(e)) return null;
  if (e.shiftKey) return 'newline';
  return e.repeat ? 'ignore' : 'submit';
}
