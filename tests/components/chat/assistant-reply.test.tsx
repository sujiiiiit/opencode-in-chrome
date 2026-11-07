import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssistantReply } from '@/components/chat/flow/assistant-reply';
import { ShellOutputProvider } from '@/components/chat/flow/live';
import type { ReplyPart, ReplyState, ReplyStatus, ReplyTextPart, ReplyToolPart } from '@/lib/opencode/reply';
import type { ShellOutputLoader } from '@/lib/opencode/shell-output';
import { SESSION_ID } from '@/tests/support/testkit';

const text = (id: string, value: string, extra: Partial<ReplyTextPart> = {}): ReplyTextPart => ({
  kind: 'text',
  id,
  ordinal: 0,
  text: value,
  done: true,
  ...extra,
});
const tool = (id: string, name: string, extra: Partial<ReplyToolPart> = {}): ReplyToolPart => ({
  kind: 'tool',
  id,
  name,
  status: 'completed',
  inputText: '',
  input: {},
  metadata: {},
  content: [],
  ...extra,
});
const reply = (status: ReplyStatus, parts: ReplyPart[], extra: Partial<ReplyState> = {}): ReplyState => ({
  sessionID: SESSION_ID,
  status,
  steps: [{ id: 's1', parts }],
  ...extra,
});

const group = () => document.querySelector<HTMLElement>('[data-slot="work-group"]')!;
const groupHeader = () => within(group()).getAllByRole('button')[0]!;
/** Live words render in their own fade-in spans: read the answer's text as a whole. */
const answer = () => document.querySelector<HTMLElement>('[data-slot="assistant-reply"]')!;

describe('AssistantReply', () => {
  it('renders a model error as muted italic streamed reply text', () => {
    render(
      <AssistantReply
        reply={reply('failed', [], { error: { type: 'provider', message: 'Usage limit reached.' } })}
      />,
    );
    const error = document.querySelector<HTMLElement>('[data-slot="assistant-error"]')!;
    expect(error).toHaveTextContent('Model error: Usage limit reached.');
    expect(error).toHaveClass('italic');
    expect(error.querySelector('.reply-md')).toHaveClass('text-text-secondary');
    expect(error.querySelector('[data-sd-animate]')).not.toBeNull();
    expect(error.querySelector('p')).not.toHaveClass('rounded-lg', 'bg-destructive/10', 'text-destructive');
  });

  it('shows Thinking while a running reply has nothing yet, in the header the first part then takes over', async () => {
    const view = render(<AssistantReply reply={reply('running', [])} />);
    const header = groupHeader();
    const label = header.querySelector('[data-slot="work-activity"]')!;
    expect(label).toHaveTextContent('Thinking');
    expect(label.querySelector('[data-slot="text-shimmer"]')).not.toBeNull();
    expect(group()).toHaveAttribute('data-disabled');
    view.rerender(<AssistantReply reply={reply('running', [tool('first_x', 'read', { status: 'running', input: { path: 'a.ts' } })])} />);
    expect(groupHeader()).toBe(header);
    expect(group()).not.toHaveAttribute('data-disabled');
    // One line, never two texts overlaid: "Thinking" fades out first, then the new label fades in.
    const activity = header.querySelector('[data-slot="work-activity"]')!;
    expect(activity).toHaveTextContent('Thinking');
    await waitFor(() => expect(activity).toHaveAttribute('data-phase', 'out'));
    expect(activity).toHaveTextContent('Thinking');
    await waitFor(() => expect(activity).toHaveTextContent('Reading a.ts'));
    expect(activity).toHaveAttribute('data-phase', 'in');
    expect(header.querySelector('[data-slot="work-activity"]')).toBe(activity);
  });

  it('morphs the live label into the completed one and eases the summary in', async () => {
    const running = tool('done_x', 'shell', { status: 'running', input: { command: 'ls' }, started: 0 });
    const view = render(<AssistantReply reply={reply('running', [running])} />);
    view.rerender(<AssistantReply reply={reply('succeeded', [{ ...running, status: 'completed', ended: 2_000 }])} />);
    expect(groupHeader().querySelector('[data-slot="work-activity"]')).toHaveTextContent('Running ls');
    await waitFor(() => expect(groupHeader().querySelector('[data-slot="work-activity"]')).toHaveTextContent('Worked for 2s'));
    expect(groupHeader().querySelector('[data-slot="work-activity"] [data-slot="text-shimmer"]')).toBeNull();
    expect(groupHeader().querySelector('[data-slot="elapsed-time"]')).toHaveTextContent('');
    expect(groupHeader()).not.toHaveTextContent('1 command');
  });

  it('sets the answer and work header at 15px and what is inside an open group at 14px, keeping their colors', () => {
    render(<AssistantReply reply={reply('succeeded', [
      text('r', 'Reasoning', { kind: 'reasoning' }),
      tool('x', 'shell', { input: { command: 'echo hi' }, content: [{ type: 'text', text: 'hi' }] }),
      text('a', 'Answer'),
    ])} />);
    expect(answer()).toHaveClass('type-body');
    expect(screen.getByText('Answer').closest('[data-slot="assistant-answer"]')).toHaveClass('mt-1');
    expect(group().querySelector('[data-tool]')).toBeNull();
    fireEvent.click(groupHeader());
    expect(within(group()).getByText('Reasoning').closest('[class*="text-"]')).toHaveClass('text-text-secondary');
    expect(groupHeader()).toHaveClass('type-work');
    const row = document.querySelector<HTMLElement>('[data-tool="shell"]')!;
    expect(row.querySelector('button')).toHaveClass('type-work');
    expect(row.querySelector('[title="echo hi"]')).toHaveClass('font-normal', 'text-text-primary');
    fireEvent.click(row.querySelector('button')!);
    expect(screen.getByLabelText('Output')).toHaveAttribute('data-slot', 'scroll-area-viewport');
    expect(row.querySelector('pre')).toHaveClass('type-work', 'font-normal', 'text-text-primary');
  });

  it('calls subsecond completed thinking a second', () => {
    render(<AssistantReply reply={reply('succeeded', [
      text('r', 'Brief thought', { kind: 'reasoning', started: 1000, ended: 1450 }),
      text('a', 'Done'),
    ])} />);
    expect(groupHeader()).toHaveTextContent('Thought for a second');
  });

  it('keeps the live header compact while its timer ticks from one to two digits', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2025-01-01T00:00:09Z'));
      render(<AssistantReply reply={reply('running', [tool('timer_x', 'shell', { status: 'running', started: Date.now() - 9_000 })])} />);
      const timer = groupHeader().querySelector<HTMLElement>('[data-slot="elapsed-time"]')!;
      expect(timer).toHaveTextContent('9s');
      expect(timer).toHaveClass('tabular-nums');
      expect(timer).toHaveAttribute('aria-hidden', 'true');
      expect(timer).not.toHaveClass('w-16');
      expect(groupHeader()).toHaveClass('w-auto', 'max-w-full');
      expect(groupHeader().querySelector('.text-text-tertiary')).not.toHaveClass('ml-auto');
      act(() => vi.advanceTimersByTime(1_000));
      expect(timer).toHaveTextContent('10s');
      expect(groupHeader().querySelector('[data-slot="elapsed-time"]')).toBe(timer);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps running work and its tool details closed until the reader opens them', () => {
    render(
      <AssistantReply
        reply={reply('running', [
          text('t1', 'Let me run the tests.', { phase: 'commentary' }),
          tool('x1', 'shell', { status: 'running', input: { command: 'npm test' } }),
        ])}
      />,
    );
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'false');
    expect(groupHeader()).toHaveTextContent('Running npm test');
    expect(groupHeader()).not.toHaveTextContent('1 command');
    fireEvent.click(groupHeader());
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'true');
    expect(group()).toHaveTextContent('Let me run the tests.');
    const row = document.querySelector('[data-tool="shell"]')!;
    const rowHeader = within(row as HTMLElement).getByRole('button');
    expect(rowHeader).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(rowHeader);
    expect(rowHeader).toHaveAttribute('aria-expanded', 'true');
    expect(within(row as HTMLElement).getByText('Running')).toHaveAttribute('data-slot', 'text-shimmer');
    expect(row).toHaveTextContent('npm test');
    fireEvent.click(groupHeader());
    fireEvent.click(groupHeader());
    expect(rowHeader).toHaveAttribute('aria-expanded', 'true');
  });

  it('updates the closed header with the current activity and keeps the clock stable', async () => {
    const first = tool('activity_read', 'read', { status: 'running', input: { path: '/src/main.ts' } });
    const second = tool('activity_search', 'websearch', { status: 'running', input: { query: 'docs' } });
    const view = render(<AssistantReply reply={reply('running', [first])} />);
    const clock = groupHeader().querySelector('[data-slot="elapsed-time"]');
    const activity = groupHeader().querySelector('[data-slot="work-activity"]');
    expect(activity).toHaveTextContent('Reading main.ts');
    expect(activity).not.toHaveAttribute('data-phase');
    // A finished call with nothing after it: the model is deciding what to do next.
    view.rerender(<AssistantReply reply={reply('running', [{ ...first, status: 'completed' }])} />);
    // A new label mid-swap waits for the swap in flight instead of cutting its fade short.
    view.rerender(<AssistantReply reply={reply('running', [{ ...first, status: 'completed' }, second])} />);
    expect(activity).toHaveTextContent('Reading main.ts');
    await waitFor(() => expect(activity).toHaveTextContent('Searching the web for "docs"'));
    await waitFor(() => expect(activity).not.toHaveAttribute('data-phase'));
    expect(groupHeader().querySelector('[data-slot="work-activity"]')).toBe(activity);
    expect(groupHeader().querySelector('[data-slot="elapsed-time"]')).toBe(clock);
    expect(groupHeader()).not.toHaveTextContent('web search');
  });

  it('names the newest running call and how many more run beside it', () => {
    render(
      <AssistantReply
        reply={reply('running', [
          tool('par_1', 'read', { status: 'running', input: { path: 'a.ts' } }),
          tool('par_2', 'read', { status: 'completed', input: { path: 'b.ts' } }),
          tool('par_3', 'grep', { status: 'running', input: { pattern: 'TODO' } }),
        ])}
      />,
    );
    expect(groupHeader()).toHaveTextContent('Searching for "TODO" +1 more');
  });

  it('says the reply waits on the reader while a question is open', () => {
    render(
      <AssistantReply
        reply={reply('running', [
          tool('ask_1', 'question', { status: 'running', input: { questions: [{ question: 'Which DB?' }] } }),
          tool('ask_2', 'read', { status: 'running', input: { path: 'a.ts' } }),
        ])}
      />,
    );
    expect(groupHeader()).toHaveTextContent('Waiting for your answer');
  });

  it('shows the reasoning heading, then the last commentary line, between calls', async () => {
    const thought: ReplyTextPart = { ...text('why_r', '**Planning the fix**\n\nThe bug is in the parser.'), kind: 'reasoning' };
    const view = render(<AssistantReply reply={reply('running', [thought])} />);
    expect(groupHeader()).toHaveTextContent('Planning the fix');
    view.rerender(
      <AssistantReply
        reply={reply('running', [tool('why_x', 'read'), text('why_t', 'Let me run the **tests**.\nThen fix it.', { phase: 'commentary' })])}
      />,
    );
    await waitFor(() => expect(groupHeader()).toHaveTextContent('Let me run the tests.'));
    expect(groupHeader()).not.toHaveTextContent('Then fix it.');
  });

  it('shows the command while it runs and summarises it once the reply is done', async () => {
    const executing = tool('execute_command', 'execute', {
      status: 'running',
      input: { command: 'cd /repo && pnpm test', description: 'Run the suite' },
    });
    const view = render(<AssistantReply reply={reply('running', [executing])} />);
    expect(groupHeader()).toHaveTextContent('Running pnpm test');
    view.rerender(<AssistantReply reply={reply('succeeded', [{ ...executing, status: 'completed' }])} />);
    expect(groupHeader()).not.toHaveTextContent('1 command');
  });

  it('keeps failures out of the folded header and says when the reply was stopped', () => {
    const { rerender } = render(
      <AssistantReply
        reply={reply('succeeded', [
          tool('bad_1', 'shell', { input: { command: 'npm test' }, metadata: { exit: 1 }, started: 0, ended: 4_000 }),
          tool('bad_2', 'edit', { status: 'error', input: { filePath: 'a.ts' } }),
        ])}
      />,
    );
    expect(groupHeader()).toHaveTextContent('Worked for 4s');
    expect(groupHeader()).not.toHaveTextContent('failed');
    rerender(
      <AssistantReply
        reply={reply('interrupted', [
          tool('cut_1', 'shell', { status: 'running', input: { command: 'sleep 9' }, started: 0 }),
          tool('cut_2', 'read', { started: 0, ended: 12_000 }),
        ])}
      />,
    );
    expect(groupHeader()).toHaveTextContent('Stopped after 12s');
  });

  it('lays open work out as hairline-divided rows in one card, without a left rail', () => {
    render(<AssistantReply reply={reply('succeeded', [
      text('spacing_r', 'First thought.\n\nSecond thought.', { kind: 'reasoning' }),
      tool('spacing_x', 'shell', { input: { command: 'pnpm test' } }),
      text('spacing_a', 'Answer.'),
    ])} />);
    fireEvent.click(groupHeader());
    const content = group().querySelector<HTMLElement>('[data-slot="scroll-area-content"] > div')!;
    expect(content).toHaveClass('divide-y');
    expect(content).not.toHaveClass('border-l', 'pl-2', 'ml-1');
    expect(content.children[0]).toHaveClass('px-3', 'py-2');
    expect(content.parentElement!.closest('.rounded-xl')).toHaveClass('border');
    expect(within(content).getByText('First thought.').closest('.reply-md')).toHaveClass('type-work', 'text-text-secondary');
    expect(within(content).getByText('Second thought.')).toBeInTheDocument();
    expect(content.querySelector('[data-tool="shell"] button')).toHaveClass('px-0');
  });

  it('bounds open work with gradient fades and follows its growing tail until the reader scrolls up', () => {
    const callbacks: ResizeObserverCallback[] = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
      observe() {}
      disconnect() {}
    });
    try {
      const work = (value: string) => reply('running', [text('scroll_reasoning', value, { kind: 'reasoning', done: false })]);
      const { rerender } = render(<AssistantReply reply={work('First paragraph.')} />);
      fireEvent.click(groupHeader());
      const viewport = group().querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
      let height = 500;
      Object.defineProperty(viewport, 'scrollHeight', { configurable: true, get: () => height });
      Object.defineProperty(viewport, 'clientHeight', { configurable: true, get: () => 288 });
      expect(viewport).toHaveClass('max-h-72', 'scroll-fade-y');
      act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
      expect(viewport.scrollTop).toBe(212);
      height = 580;
      rerender(<AssistantReply reply={work('First paragraph. More streamed content.')} />);
      expect(viewport.scrollTop).toBe(292);
      viewport.scrollTop = 100;
      fireEvent.scroll(viewport);
      height = 650;
      act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
      expect(viewport.scrollTop).toBe(100);
      viewport.scrollTop = 362;
      fireEvent.scroll(viewport);
      height = 700;
      act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
      expect(viewport.scrollTop).toBe(412);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('starts at the top when completed work is reopened', () => {
    render(<AssistantReply reply={reply('succeeded', [
      text('finished_scroll_r', 'A long explanation.', { kind: 'reasoning' }),
      text('finished_scroll_a', 'Final answer.'),
    ])} />);
    fireEvent.click(groupHeader());
    const viewport = group().querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    viewport.scrollTop = 120;
    fireEvent.click(groupHeader());
    fireEvent.click(groupHeader());
    expect(viewport.scrollTop).toBe(0);
  });

  it('keeps work folded when the answer starts and summarises it', async () => {
    const work = [text('fold_t1', 'Checking.', { phase: 'commentary' }), tool('fold_x1', 'shell', { input: { command: 'ls' } }), tool('fold_x2', 'edit')];
    const { rerender } = render(<AssistantReply reply={reply('running', work)} />);
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'false');
    rerender(<AssistantReply reply={reply('running', [...work, text('a1', 'All done', { done: false })])} />);
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'false');
    expect(groupHeader()).not.toHaveTextContent('1 file edited');
    expect(answer()).toHaveTextContent('All done');
  });

  it('keeps a reader-opened group open during work, then folds it when the work ends', () => {
    const first = tool('opened_x1', 'shell', { status: 'running', input: { command: 'npm test' } });
    const { rerender } = render(<AssistantReply reply={reply('running', [first])} />);
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(groupHeader());
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'true');
    rerender(<AssistantReply reply={reply('running', [tool('opened_x1', 'shell'), tool('opened_x2', 'edit')])} />);
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'true');
    rerender(<AssistantReply reply={reply('succeeded', [tool('opened_x1', 'shell'), tool('opened_x2', 'edit'), text('opened_a', 'Done')])} />);
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(groupHeader());
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'true');
  });

  it('folds an opened work group as soon as answer text begins', () => {
    const work = [tool('answerfold_x', 'read')];
    const { rerender } = render(<AssistantReply reply={reply('running', work)} />);
    fireEvent.click(groupHeader());
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'true');
    rerender(<AssistantReply reply={reply('running', [...work, text('answerfold_a', 'Result', { done: false })])} />);
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(groupHeader());
    rerender(<AssistantReply reply={reply('succeeded', [...work, text('answerfold_a', 'Result')])} />);
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not remount earlier text or toggle its group when another tool arrives', () => {
    const first = text('early', 'Checking.', { done: false });
    const { rerender } = render(<AssistantReply reply={reply('running', [first])} />);
    const early = answer().querySelector('[data-sd-animate]');
    expect(early).not.toBeNull();
    rerender(<AssistantReply reply={reply('running', [text('early', 'Checking.')])} />);
    expect(answer().querySelector('[data-sd-animate]')).toBe(early);
    rerender(<AssistantReply reply={reply('running', [text('early', 'Checking.'), tool('x1', 'read')])} />);
    // The faded-in words keep their nodes while the reply runs (no re-parse, no fade replay).
    expect(answer().querySelector('[data-sd-animate]')).toBe(early);
    expect(answer().textContent).toContain('Checking.');
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'false');
    const originalGroup = group();
    rerender(<AssistantReply reply={reply('running', [text('early', 'Checking.'), tool('x1', 'read'), tool('x2', 'edit')])} />);
    expect(document.querySelectorAll('[data-slot="work-group"]')).toHaveLength(1);
    expect(group()).toBe(originalGroup);
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'false');
  });

  it('animates only the latest text part', () => {
    const { rerender } = render(<AssistantReply reply={reply('running', [text('a', 'First', { done: false })])} />);
    const firstWords = [...answer().querySelectorAll('[data-sd-animate]')];
    expect(firstWords.length).toBeGreaterThan(0);
    const answers = () => [...document.querySelectorAll('[data-slot="assistant-answer"]')];
    const words = (element: Element) => [...element.querySelectorAll('[data-sd-animate]')];
    rerender(<AssistantReply reply={reply('running', [text('a', 'First'), text('b', 'Second', { done: false })])} />);
    // The new part fades in; the earlier one keeps the nodes it faded in with, so it never fades again.
    expect(words(answers()[1]!).map((item) => item.textContent).join('')).toContain('Second');
    expect(words(answers()[0]!)).toEqual(firstWords);
    rerender(<AssistantReply reply={reply('running', [text('a', 'First', { done: false }), text('b', 'Second', { done: false })])} />);
    expect(words(answers()[0]!)).toEqual(firstWords);
    // Once the reply finishes, its answers render as plain settled text.
    rerender(<AssistantReply reply={reply('succeeded', [text('a', 'First'), text('b', 'Second')])} />);
    expect(answer().querySelector('[data-sd-animate]')).toBeNull();
    expect(answer().textContent).toContain('FirstSecond');
  });

  it('compresses a fast batch into a short reveal backlog', () => {
    render(<AssistantReply reply={reply('running', [text('batch', Array.from({ length: 30 }, (_, i) => `word${i}`).join(' '), { done: false })])} />);
    const delays = [...answer().querySelectorAll<HTMLElement>('[data-sd-animate]')]
      .map((item) => Number(item.style.getPropertyValue('--sd-delay').replace('ms', '')) || 0);
    expect(delays.length).toBeGreaterThan(20);
    expect(Math.max(...delays)).toBeLessThanOrEqual(60);
    expect([...answer().querySelectorAll<HTMLElement>('[data-sd-animate]')].every((item) =>
      Number(item.style.getPropertyValue('--sd-duration').replace('ms', '')) <= 120,
    )).toBe(true);
  });

  it('does not fade the whole answer container while its words fade in', () => {
    render(<AssistantReply reply={reply('running', [text('a', 'Visible immediately', { done: false })])} />);
    expect(answer().querySelector('[data-sd-animate]')).not.toBeNull();
    expect(answer().firstElementChild).not.toHaveClass('animate-in');
  });

  it('does not fade a whole work part on top of its streamed words', () => {
    render(<AssistantReply reply={reply('running', [text('r', 'Checking', { kind: 'reasoning', done: false })])} />);
    fireEvent.click(groupHeader());
    expect(group().querySelector('[data-sd-animate]')).not.toBeNull();
    expect(group().querySelector('[data-sd-animate]')?.closest('.animate-in')).toBeNull();
  });

  it('keeps a completed paragraph element while another markdown block grows', () => {
    const { rerender } = render(<AssistantReply reply={reply('running', [text('a', 'First paragraph.\n\n**Sec', { done: false })])} />);
    const first = answer().querySelector('p');
    expect(first).toHaveTextContent('First paragraph.');
    rerender(<AssistantReply reply={reply('running', [text('a', 'First paragraph.\n\n**Second** paragraph.', { done: false })])} />);
    expect(answer().querySelector('p')).toBe(first);
    expect(answer()).toHaveTextContent('Second paragraph.');
  });

  it('keeps an earlier word stable while a partial word and markdown tail grow', () => {
    const { rerender } = render(<AssistantReply reply={reply('running', [text('a', 'Stable hel', { done: false })])} />);
    const paragraph = answer().querySelector('p');
    const stable = [...answer().querySelectorAll('[data-sd-animate]')].find((node) => node.textContent?.trim() === 'Stable');
    expect(stable).toBeDefined();
    rerender(<AssistantReply reply={reply('running', [text('a', 'Stable hello **world', { done: false })])} />);
    expect(answer().querySelector('p')).toBe(paragraph);
    expect(answer()).toHaveTextContent('Stable hello world');
    const settledWord = [...answer().querySelectorAll<HTMLElement>('[data-sd-animate]')].find((node) => node.textContent?.trim() === 'Stable');
    expect(settledWord).toBe(stable);
    expect(settledWord?.style.getPropertyValue('--sd-duration')).toBe('0ms');
  });

  it('keeps a completed paragraph element when the reply settles', () => {
    const { rerender } = render(<AssistantReply reply={reply('running', [text('a', 'First paragraph.\n\nSecond paragraph.', { done: false })])} />);
    const first = answer().querySelector('p');
    expect(first).toHaveTextContent('First paragraph.');
    rerender(<AssistantReply reply={reply('succeeded', [text('a', 'First paragraph.\n\nSecond paragraph.')])} />);
    expect(answer().querySelector('p')).toBe(first);
  });

  it('keeps preceding prose in place while a code fence opens and fills', () => {
    const { rerender } = render(<AssistantReply reply={reply('running', [text('a', 'Intro.\n\n```ts\ncon', { done: false })])} />);
    const intro = answer().querySelector('p');
    expect(intro).toHaveTextContent('Intro.');
    rerender(<AssistantReply reply={reply('running', [text('a', 'Intro.\n\n```ts\nconst value = 1;\n```', { done: false })])} />);
    expect(answer().querySelector('p')).toBe(intro);
    expect(answer()).toHaveTextContent('const value = 1;');
  });

  it('remembers the reader opening a finished group', () => {
    const parts = [tool('remember_x1', 'grep', { input: { pattern: 'TODO' } }), text('a1', 'Found it.')];
    const { unmount } = render(<AssistantReply reply={reply('succeeded', parts)} />);
    fireEvent.click(groupHeader());
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'true');
    unmount();
    render(<AssistantReply reply={reply('succeeded', parts)} />);
    expect(groupHeader()).toHaveAttribute('aria-expanded', 'true');
  });

  it('marks a failed call and a non-zero exit, and calls left by a stopped reply', () => {
    render(
      <AssistantReply
        reply={reply('interrupted', [
          tool('x1', 'read', { status: 'error', error: 'No such file' }),
          tool('x2', 'shell', { metadata: { exit: 1 } }),
          tool('x3', 'shell', { status: 'running' }),
        ])}
      />,
    );
    fireEvent.click(groupHeader());
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Exit 1')).toBeInTheDocument();
    expect(within(document.querySelector<HTMLElement>('[data-tool="shell"][data-status="running"]')!).getByText('Stopped')).toBeInTheDocument();
    expect(groupHeader()).toHaveTextContent('Stopped');
    expect(groupHeader()).not.toHaveTextContent('failed');
  });

  it('reads a call the interrupt failed as stopped, not failed, and leaves it out of the summary', () => {
    render(
      <AssistantReply
        reply={reply('interrupted', [
          tool('ab_1', 'webfetch', { input: { url: 'https://a.dev' }, started: 0, ended: 1_000 }),
          tool('ab_2', 'webfetch', { status: 'error', error: 'Tool execution interrupted', aborted: true, input: { url: 'https://b.dev' }, started: 1_000, ended: 5_000 }),
        ])}
      />,
    );
    expect(groupHeader()).toHaveTextContent('Stopped after 5s');
    expect(groupHeader()).not.toHaveTextContent('1 page opened');
    fireEvent.click(groupHeader());
    expect(within(document.querySelector<HTMLElement>('[data-tool="webfetch"][data-status="error"]')!).getByText('Stopped')).toBeInTheDocument();
    expect(screen.queryByText('Failed')).toBeNull();
  });

  it('closes an interrupted reply with its footer, below the work that came after the last answer', () => {
    render(
      <AssistantReply
        reply={reply('interrupted', [
          tool('ft_1', 'webfetch'),
          text('ft_a', 'Found it. Now let me check the repo.'),
          tool('ft_2', 'webfetch', { status: 'error', error: 'Tool execution interrupted', aborted: true }),
        ])}
      />,
    );
    const root = answer();
    const footer = root.querySelector('[data-slot="message-footer"]')!;
    const groups = root.querySelectorAll('[data-slot="work-group"]');
    expect(root).toHaveAttribute('data-footer-host');
    expect(groups[1]!.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const notice = root.querySelector('[data-slot="reply-interrupted"]');
    expect(notice).toHaveTextContent('Stopped before the reply finished.');
    expect(footer.compareDocumentPosition(notice!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(footer as HTMLElement).getByRole('button', { name: 'Copy response' })).toBeInTheDocument();
  });

  it('opens a running shell onto its output, read live from the server', async () => {
    const load = vi.fn<ShellOutputLoader>(async () => ({ output: '\u001b[32mPASS\u001b[0m 3 tests', cursor: 14, size: 14 }));
    render(
      <ShellOutputProvider value={load}>
        <AssistantReply
          reply={reply('running', [
            tool('live_shell_x', 'shell', { status: 'running', input: { command: 'npm test' }, metadata: { shellID: 'sh_live' } }),
          ])}
        />
      </ShellOutputProvider>,
    );
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(groupHeader());
    fireEvent.click(within(document.querySelector('[data-tool="shell"]') as HTMLElement).getByRole('button'));
    await waitFor(() => expect(screen.getByLabelText('Output')).toHaveTextContent('PASS 3 tests'));
    expect(load).toHaveBeenCalledWith('sh_live', 0);
  });

  it('shows a finished shell’s saved output without asking the server', () => {
    const load = vi.fn<ShellOutputLoader>();
    render(
      <ShellOutputProvider value={load}>
        <AssistantReply
          reply={reply('succeeded', [
            tool('saved_x1', 'shell', {
              input: { command: 'echo hi' },
              metadata: { shellID: 'sh_done', status: 'exited', exit: 0 },
              content: [{ type: 'text', text: 'hi' }],
            }),
            text('a1', 'Printed it.'),
          ])}
        />
      </ShellOutputProvider>,
    );
    fireEvent.click(groupHeader());
    fireEvent.click(screen.getByRole('button', { name: /ran/i }));
    expect(screen.getByLabelText('Output')).toHaveTextContent('hi');
    expect(load).not.toHaveBeenCalled();
  });
});
