// Follows a background shell's output (GET /api/shell/{id}/output) while the shell runs, ported
// from opencode's session UI. Only the tail is kept; progress is remembered per shell so a widget
// that remounts resumes from its cursor instead of re-reading from zero.

/** Same page size as opencode's shell output viewer: only this much recent output is kept. */
export const SHELL_OUTPUT_TAIL = 64 * 1024;
const REMEMBERED = 32;
const POLL_MS = 1_000;

export type ShellPage = { output: string; cursor: number; size: number };
/** Reads output from `cursor`; `missing` once the server no longer knows the shell. */
export type ShellOutputLoader = (id: string, cursor: number) => Promise<ShellPage | 'missing'>;

type Progress = { cursor: number; output: string; state: 'partial' | 'complete' | 'missing' };

const progress = new Map<string, Progress>();

function remember(id: string, entry: Progress) {
  progress.delete(id);
  progress.set(id, entry);
  if (progress.size <= REMEMBERED) return;
  const oldest = progress.keys().next().value;
  if (oldest !== undefined) progress.delete(oldest);
}

/**
 * Reads the shell's output into `onOutput` (the whole retained tail each time), polling while it
 * runs. Returns the stop function.
 */
export function followShellOutput(input: {
  id: string;
  running: boolean;
  load: ShellOutputLoader;
  onOutput: (output: string) => void;
}): () => void {
  const cached = progress.get(input.id);
  if (cached) {
    remember(input.id, cached);
    input.onOutput(cached.output);
  }
  // A missing shell never comes back; a complete one is only re-read while it is believed to run.
  if (cached?.state === 'missing' || (cached?.state === 'complete' && !input.running)) return () => undefined;

  let cursor = cached?.cursor ?? 0;
  let text = cached?.output ?? '';
  let loading = false;
  let disposed = false;
  let interval: ReturnType<typeof setInterval> | undefined;

  /** Takes in one page; true when the next page should be read right away. */
  const take = (page: ShellPage | 'missing' | null): boolean => {
    if (disposed || !page) return false;
    if (page === 'missing') {
      remember(input.id, { cursor, output: text, state: 'missing' });
      clearInterval(interval);
      return false;
    }
    const advanced = page.cursor > cursor;
    cursor = Math.max(cursor, page.cursor);
    text = (text + page.output).slice(-SHELL_OUTPUT_TAIL);
    const complete = !input.running && cursor >= page.size;
    remember(input.id, { cursor, output: text, state: complete ? 'complete' : 'partial' });
    input.onOutput(text);
    // A finished shell is read to its end in one go; a live one a page per poll.
    return !input.running && !complete && advanced;
  };

  const read = async () => {
    if (loading) return;
    loading = true;
    try {
      while (take(await input.load(input.id, cursor).catch(() => null)));
    } finally {
      loading = false;
    }
  };

  void read();
  if (input.running) interval = setInterval(() => void read(), POLL_MS);
  return () => {
    disposed = true;
    clearInterval(interval);
  };
}

// The pattern strip-ansi 7 uses (ansi-regex 6): OSC sequences ending in BEL, ESC\ or 0x9c, plus CSI
// and related escapes. An OSC payload stops at its first terminator.
const ANSI =
  /(?:\u001B\][^\u0007\u001B\u009C]*(?:\u0007|\u001B\|\u009C))|[\u001B\u009B][[\]()#;?]*(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]/g;

/** Terminal output as plain text: colour and cursor codes removed, line endings normalised. */
export const plainTerminalText = (text: string) => text.replace(ANSI, '').replace(/\r\n?/g, '\n');
