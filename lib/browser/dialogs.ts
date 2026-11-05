// Page dialogs (spec browser/page-actions): alert, confirm, prompt and leave-page dialogs
// freeze the page, so they are tracked from CDP events, reported in results, and answered
// through the `dialog` action. While one is open, page calls fail with DIALOG_OPEN.
import type { DebuggerSessions } from './debugger';
import { ToolError } from './tools/registry';

export type OpenDialog = { type: string; message: string; defaultPrompt?: string; sessionId?: string };

export class Dialogs {
  private readonly open = new Map<number, OpenDialog>();
  private readonly waiters = new Map<number, Set<(d: OpenDialog) => void>>();

  constructor(private readonly debuggers: DebuggerSessions) {
    debuggers.subscribe((event) => {
      if (event.method === 'Page.javascriptDialogOpening') {
        const dialog: OpenDialog = {
          type: String(event.params.type ?? 'alert'),
          message: String(event.params.message ?? ''),
          defaultPrompt: event.params.defaultPrompt as string | undefined,
          sessionId: event.sessionId,
        };
        this.open.set(event.tabId, dialog);
        for (const w of this.waiters.get(event.tabId) ?? []) w(dialog);
        this.waiters.delete(event.tabId);
      } else if (event.method === 'Page.javascriptDialogClosed') {
        this.open.delete(event.tabId);
      }
    });
    debuggers.onDetach((tabId) => this.open.delete(tabId));
  }

  get(tabId: number): OpenDialog | undefined {
    return this.open.get(tabId);
  }

  /** `Dialog open: confirm "Delete item?"` */
  static describe(dialog: OpenDialog): string {
    return `Dialog open: ${dialog.type} ${JSON.stringify(dialog.message)}`;
  }

  /** Throws DIALOG_OPEN while the tab shows a dialog (page scripts would hang). */
  assertClear(tabId: number): void {
    const dialog = this.open.get(tabId);
    if (dialog) {
      throw new ToolError(
        'DIALOG_OPEN',
        `${Dialogs.describe(dialog)}. Answer it first with computer action "dialog" (accept: true or false${dialog.type === 'prompt' ? ', text for the prompt' : ''}).`,
      );
    }
  }

  /** Resolves when a dialog opens on the tab (used to stop waiting on input that it blocks). */
  opened(tabId: number): Promise<OpenDialog> {
    const current = this.open.get(tabId);
    if (current) return Promise.resolve(current);
    return new Promise((resolve) => {
      const set = this.waiters.get(tabId) ?? new Set();
      set.add(resolve);
      this.waiters.set(tabId, set);
    });
  }

  async answer(tabId: number, accept: boolean, promptText?: string): Promise<OpenDialog> {
    const dialog = this.open.get(tabId);
    if (!dialog) throw new ToolError('INVALID_INPUT', 'No dialog is open on this tab.');
    await this.debuggers.send(
      tabId,
      'Page.handleJavaScriptDialog',
      { accept, ...(promptText !== undefined ? { promptText } : {}) },
      { sessionId: dialog.sessionId },
    );
    this.open.delete(tabId);
    return dialog;
  }
}
