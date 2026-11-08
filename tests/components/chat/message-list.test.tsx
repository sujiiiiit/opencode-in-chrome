import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '@/components/chat/message-list';
import type { PendingMessage } from '@/lib/opencode/chat';
import type { ReplyState } from '@/lib/opencode/reply';
import type { Turn } from '@/lib/opencode/timeline';
import { PROVIDER_ERROR, SESSION_ID } from '@/tests/support/testkit';

const reply = (status: ReplyState['status'], text = '', extra: Partial<ReplyState> = {}): ReplyState => ({
  sessionID: SESSION_ID,
  status,
  steps: text ? [{ id: 'a1', parts: [{ kind: 'text', id: 'a1:text:0', ordinal: 0, text, done: true }] }] : [],
  ...extra,
});
const turn = (id: string, text: string, r: ReplyState): Turn => ({ id, text, reply: r });

type Props = ComponentProps<typeof MessageList>;
function setup(props: Partial<Props> = {}) {
  render(<MessageList turns={[]} pending={[]} {...props} />);
}

const steer = (id: string, text: string, status: PendingMessage['status'], local = false): PendingMessage => ({ id, text, status, local });
const bubble = (text: string) => screen.getByText(text).closest<HTMLElement>('[data-slot="user-message"]')!;

describe('MessageList goal turns', () => {
  const goalTurn = (r: ReplyState): Turn => ({ id: 'k1', text: '', goal: { id: 'g1', objective: 'Make the tests pass' }, reply: r });
  const goal = (status: 'active' | 'paused' | 'complete', reason?: string) => ({ id: 'g1', objective: 'Make the tests pass', status, rounds: 2, maxRounds: 50, reason });

  it('opens a goal turn with its objective instead of a user bubble', () => {
    setup({ turns: [goalTurn(reply('running', 'Working'))], goal: goal('active') });
    expect(screen.getByText('Goal · Make the tests pass')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="user-message"]')).toBeNull();
    expect(document.querySelector('[data-slot="goal-outcome"]')).toBeNull();
  });

  it('marks each round where the reply picked up again', () => {
    const r = reply('running', 'Round one');
    r.notices = [{ id: 'r1', afterStep: 1, goal: { reason: 'Two tests still fail', resumed: false } }];
    setup({ turns: [goalTurn(r)], goal: goal('active') });
    expect(screen.getByText('Round 2 · Two tests still fail')).toBeInTheDocument();
  });

  it('closes the goal turn with how it ended', () => {
    setup({ turns: [goalTurn(reply('succeeded', 'Done'))], goal: goal('complete', 'All 986 tests pass') });
    expect(screen.getByText('Goal met · All 986 tests pass')).toBeInTheDocument();
  });

  it('says why a goal paused', () => {
    setup({ turns: [goalTurn(reply('succeeded', 'Stuck'))], goal: goal('paused', 'Not making progress') });
    expect(screen.getByText('Goal paused · Not making progress')).toBeInTheDocument();
  });
});

describe('MessageList', () => {
  it('renders model and variant switches in the conversation', () => {
    const model = { providerID: 'p', modelID: 'new' };
    setup({ turns: [{ ...turn('m1', 'hello', reply('succeeded')), switches: [{ id: 's1', model }] }],
      switches: [{ id: 's2', model: { ...model, variant: 'high' }, previous: model }] });
    expect(screen.getByText('Switched to new')).toBeInTheDocument();
    expect(screen.getByText('Switched variant to high')).toBeInTheDocument();
  });
  it('renders a turn: prompt, its folded work, then the answer', () => {
    const r = reply('succeeded');
    r.steps = [
      {
        id: 'a1',
        parts: [
          { kind: 'reasoning', id: 'a1:reasoning:0', ordinal: 0, text: 'The user wants pong.', done: true },
          {
            kind: 'tool',
            id: 't1',
            name: 'read',
            status: 'completed',
            inputText: '',
            input: { path: 'src/pong.ts' },
            metadata: {},
            content: [],
          },
          { kind: 'text', id: 'a1:text:0', ordinal: 0, text: 'pong', done: true },
        ],
      },
    ];
    setup({ turns: [turn('m1', 'hello', r)] });
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(bubble('hello').querySelector('[data-message-id]')).toHaveClass('type-body');
    expect(screen.getByText('pong')).toBeInTheDocument();
    // A finished turn's work is folded under its header (the counts are hidden for now).
    const header = screen.getByRole('button', { name: /worked/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(header).not.toHaveTextContent('1 file read');
  });

  it('shows Thinking only on a running turn that has no text yet', () => {
    setup({ turns: [turn('m1', 'one', reply('succeeded')), turn('m2', 'two', reply('running'))] });
    expect(screen.getAllByText(/thinking/i)).toHaveLength(1);
  });

  it('shows model errors and interruptions on their turn', () => {
    setup({
      turns: [
        turn('m1', 'one', reply('failed', '', { error: { type: PROVIDER_ERROR.type, message: PROVIDER_ERROR.message } })),
        turn('m2', 'two', reply('interrupted')),
      ],
    });
    expect(document.querySelector('[data-slot="assistant-error"]')).toHaveTextContent(`Model error: ${PROVIDER_ERROR.message}`);
    expect(screen.getByText('Stopped before the reply finished.')).toBeInTheDocument();
  });

  it('shows waiting prompts after the turns, dimmed, with no label or actions', () => {
    setup({
      turns: [turn('m1', 'first', reply('running'))],
      pending: [steer('p1', 'U2: retry path', 'steering'), steer('p2', 'U3: rebase', 'steering')],
    });
    const texts = screen.getAllByTestId('user-text').map((el) => el.textContent);
    expect(texts).toEqual(['first', 'U2: retry path', 'U3: rebase']);
    expect(bubble('U2: retry path')).toHaveAttribute('data-pending', 'true');
    expect(bubble('U3: rebase')).toHaveAttribute('data-pending', 'true');
    expect(screen.queryByText('Pending')).toBeNull();
    expect(within(bubble('U2: retry path')).queryByRole('button')).toBeNull();
    expect(within(bubble('U3: rebase')).queryByRole('button')).toBeNull();
  });

  it('does not mark a starting prompt as waiting', () => {
    setup({ pending: [steer('p1', 'start me', 'starting')] });
    expect(bubble('start me')).not.toHaveAttribute('data-pending');
  });

  it('marks stranded and queued prompts as waiting', () => {
    setup({ pending: [steer('p1', 'left behind', 'stranded'), steer('p2', 'from elsewhere', 'queued')] });
    expect(bubble('left behind')).toHaveAttribute('data-pending', 'true');
    expect(bubble('from elsewhere')).toHaveAttribute('data-pending', 'true');
  });

  it('shows a prompt the server has not admitted yet as waiting, without actions', () => {
    setup({ pending: [steer('l1', 'sending', 'steering', true)] });
    expect(bubble('sending')).toHaveAttribute('data-pending', 'true');
    expect(within(bubble('sending')).queryByRole('button')).toBeNull();
  });

  it('keeps image tiles mounted as a pending prompt becomes a running turn', () => {
    const files = [{ kind: 'image' as const, name: 'shot.png', mime: 'image/png', src: 'blob:preview' }];
    const pending = [{ ...steer('p1', 'look', 'starting', true), files }];
    const { rerender } = render(<MessageList turns={[]} pending={pending} />);
    const tile = screen.getByRole('button', { name: 'Preview shot.png' });
    rerender(<MessageList turns={[{ ...turn('p1', 'look', reply('running')), files }]} pending={[]} />);
    expect(screen.getByRole('button', { name: 'Preview shot.png' })).toBe(tile);
  });

  it('renders a reply as markdown but never parses its HTML', () => {
    const evil = '<img src=x onerror=alert(1)><b>bold</b> and **strong**';
    const { container } = render(
      <MessageList turns={[turn('m1', evil, reply('succeeded', evil))]} pending={[]} />,
    );
    expect(container.querySelector('img, b, [onerror]')).toBeNull();
    // The tags read as the text they are; markdown still formats.
    expect(container.textContent).toContain('<b>bold</b>');
    expect(container.querySelector('[data-streamdown="strong"]')).toHaveTextContent('strong');
  });
});

describe('MessageList: scrolling', () => {
  afterEach(() => vi.unstubAllGlobals());
  function frames() {
    let next = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.set(++next, callback);
      return next;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    return (time: number) => act(() => {
      const queued = [...callbacks.values()];
      callbacks.clear();
      queued.forEach((callback) => callback(time));
    });
  }
  /** Gives the viewport a size (happy-dom has no layout): `content` tall, 200px visible. */
  function sized(content: { height: number }) {
    const viewport = document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, get: () => content.height });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, get: () => 200 });
    return viewport;
  }
  /** The reader scrolls (a wheel turn, then the scroll it causes). */
  const scrollTo = (viewport: HTMLElement, top: number) => {
    fireEvent.wheel(viewport);
    viewport.scrollTop = top;
    fireEvent.scroll(viewport);
  };
  /** The browser scrolls on its own (scroll anchoring, clamping), with no reader input. */
  const browserScroll = (viewport: HTMLElement, top: number) => {
    viewport.scrollTop = top;
    fireEvent.scroll(viewport);
  };

  const first = turn('m1', 'one', reply('succeeded', 'done'));
  const streaming = (text: string) => [first, turn('m2', 'two', reply('running', text))];

  it('makes a cubic page turn when text is about to leave the viewport', () => {
    const frame = frames();
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 800);
    content.height = 1200;
    rerender(<MessageList turns={streaming('a b')} pending={[]} />);
    expect(document.querySelector('[data-slot="stream-space"]')).toHaveStyle({ height: '138px' });
    expect(viewport.scrollTop).toBe(800);
    frame(performance.now() + 300);
    expect(viewport.scrollTop).toBeGreaterThan(800);
    expect(viewport.scrollTop).toBeLessThan(1000);
    frame(performance.now() + 720);
    expect(viewport.scrollTop).toBe(1000);
  });

  it('lets incoming text extend an active page turn without restarting its animation', () => {
    const frame = frames();
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 800);
    const start = performance.now();
    content.height = 1200;
    rerender(<MessageList turns={streaming('a b')} pending={[]} />);
    frame(start + 200);
    const underway = viewport.scrollTop;
    expect(underway).toBeGreaterThan(800);
    expect(underway).toBeLessThan(1000);
    content.height = 1240;
    rerender(<MessageList turns={streaming('a b c')} pending={[]} />);
    expect(viewport.scrollTop).toBe(underway);
    frame(start + 220);
    expect(viewport.scrollTop).toBeGreaterThan(underway);
    expect(viewport.scrollTop).toBeLessThan(underway + 30);
    frame(start + 400);
    expect(viewport.scrollTop).toBeGreaterThan(underway);
    expect(viewport.scrollTop).toBeLessThan(1040);
    frame(start + 720);
    expect(viewport.scrollTop).toBe(1040);
    content.height = 1260;
    rerender(<MessageList turns={streaming('a b c d')} pending={[]} />);
    frame(start + 960);
    expect(viewport.scrollTop).toBe(1040);
  });

  it('waits until streamed content reaches 100 percent of the viewport', () => {
    const frame = frames();
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 800);
    // The 150px follow space is excluded: 1149 leaves content at 99.5% of the viewport.
    content.height = 1149;
    rerender(<MessageList turns={streaming('a b')} pending={[]} />);
    frame(performance.now() + 720);
    expect(viewport.scrollTop).toBe(800);

    // One more pixel reaches 100%, so the page turns.
    content.height = 1150;
    rerender(<MessageList turns={streaming('a b c')} pending={[]} />);
    frame(performance.now() + 720);
    expect(viewport.scrollTop).toBe(950);
  });

  it('leaves a reply in place when it finishes just before the edge', () => {
    const frame = frames();
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 800);
    content.height = 1149;
    rerender(<MessageList turns={[first, turn('m2', 'two', reply('succeeded', 'a b'))]} pending={[]} />);
    frame(performance.now() + 720);
    expect(viewport.scrollTop).toBe(800);
  });

  it('keeps the reader’s place when they scrolled up while a reply streams', () => {
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 100);
    content.height = 1200;
    rerender(<MessageList turns={streaming('a b')} pending={[]} />);
    expect(viewport.scrollTop).toBe(100);
  });

  it('shows a wave while streaming away from the bottom', () => {
    render(<MessageList turns={streaming('a')} pending={[]} />);
    const viewport = sized({ height: 1000 });
    const hidden = document.querySelector('[data-slot="go-to-bottom"]');
    expect(hidden).toHaveAttribute('data-visible', 'false');
    expect(hidden).toHaveAttribute('aria-hidden', 'true');
    expect(hidden).toHaveClass(
      'data-[visible=false]:translate-y-12',
      'data-[visible=false]:scale-75',
      'data-[visible=false]:opacity-0',
    );
    scrollTo(viewport, 100);
    const button = screen.getByRole('button', { name: 'Scroll to bottom' });
    expect(button).toHaveAttribute('data-streaming', 'true');
    expect(button).toHaveAttribute('data-visible', 'true');
    expect(button).toHaveAttribute('aria-hidden', 'false');
    const dots = button.querySelectorAll('span > span');
    expect(button.querySelector('span')).toHaveClass('text-text-secondary');
    expect(dots).toHaveLength(3);
    dots.forEach((dot) => expect(dot).toHaveClass('size-[3px]'));
  });

  it('shows a down arrow when a finished chat is away from the bottom', () => {
    render(<MessageList turns={[first]} pending={[]} />);
    const viewport = sized({ height: 1000 });
    scrollTo(viewport, 100);
    const button = screen.getByRole('button', { name: 'Scroll to bottom' });
    expect(button).not.toHaveAttribute('data-streaming');
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('scrolls to the bottom and resumes following when the button is clicked', () => {
    const frame = frames();
    const content = { height: 1000 };
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    const viewport = sized(content);
    scrollTo(viewport, 100);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll to bottom' }));
    expect(screen.queryByRole('button', { name: 'Scroll to bottom' })).toBeNull();
    frame(performance.now() + 240);
    expect(viewport.scrollTop).toBe(800);

    content.height = 1200;
    rerender(<MessageList turns={streaming('a b')} pending={[]} />);
    frame(performance.now() + 720);
    expect(viewport.scrollTop).toBe(1000);
  });

  it('hides the button after the reader returns to the bottom', () => {
    render(<MessageList turns={streaming('a')} pending={[]} />);
    const viewport = sized({ height: 1000 });
    scrollTo(viewport, 100);
    expect(screen.getByRole('button', { name: 'Scroll to bottom' })).toBeInTheDocument();
    scrollTo(viewport, 800);
    expect(screen.queryByRole('button', { name: 'Scroll to bottom' })).toBeNull();
  });

  it('stops following after even a small scroll up while the text is still on screen', () => {
    const frame = frames();
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 800);
    scrollTo(viewport, 780);
    content.height = 1200;
    rerender(<MessageList turns={streaming('a b')} pending={[]} />);
    frame(performance.now() + 720);
    expect(viewport.scrollTop).toBe(780);
  });

  it('keeps following when the browser moves the scroll on its own', () => {
    const frame = frames();
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 800);
    // A second later, scroll anchoring nudges the list while the text is already past the fold.
    const later = performance.now() + 1000;
    vi.spyOn(performance, 'now').mockReturnValue(later);
    content.height = 1180;
    browserScroll(viewport, 790);
    content.height = 1200;
    rerender(<MessageList turns={streaming('a b')} pending={[]} />);
    frame(later + 720);
    vi.restoreAllMocks();
    expect(viewport.scrollTop).toBe(1000);
  });

  it('stops a running follow animation when the reader scrolls up', () => {
    const frame = frames();
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 800);
    content.height = 1200;
    rerender(<MessageList turns={streaming('a b')} pending={[]} />);
    frame(performance.now() + 70);
    scrollTo(viewport, 300);
    frame(performance.now() + 240);
    expect(viewport.scrollTop).toBe(300);
    content.height = 1300;
    rerender(<MessageList turns={streaming('a b c')} pending={[]} />);
    frame(performance.now() + 480);
    expect(viewport.scrollTop).toBe(300);
  });

  it('keeps the breathing room when a streamed reply finishes', () => {
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    sized({ height: 1000 });
    rerender(<MessageList turns={[first, turn('m2', 'two', reply('succeeded', 'a'))]} pending={[]} />);
    expect(document.querySelector('[data-slot="stream-space"]')).toHaveStyle({ height: '138px' });
  });

  it('snaps to the follow position when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { rerender } = render(<MessageList turns={streaming('a')} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 800);
    content.height = 1200;
    rerender(<MessageList turns={streaming('a b')} pending={[]} />);
    expect(viewport.scrollTop).toBe(1000);
  });

  it('recomputes the breathing room when the viewport changes height', () => {
    const callbacks: ResizeObserverCallback[] = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
      observe() {}
      disconnect() {}
    });
    render(<MessageList turns={streaming('a')} pending={[]} />);
    const viewport = document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    let height = 200;
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, get: () => height });
    act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
    expect(document.querySelector('[data-slot="stream-space"]')).toHaveStyle({ height: '138px' });
    height = 400;
    act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
    expect(document.querySelector('[data-slot="stream-space"]')).toHaveStyle({ height: '288px' });
    // A tall viewport keeps a fixed 300px of room (less the 12px the list padding supplies).
    height = 900;
    act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
    expect(document.querySelector('[data-slot="stream-space"]')).toHaveStyle({ height: '288px' });
  });

  it('preserves the reader’s place when older turns are added above', () => {
    const later = streaming('a');
    const { rerender } = render(<MessageList turns={later} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    rerender(<MessageList turns={[...later]} pending={[]} />);
    scrollTo(viewport, 100);
    content.height = 1200;
    rerender(<MessageList turns={[turn('m0', 'earlier', reply('succeeded')), ...later]} pending={[]} />);
    expect(viewport.scrollTop).toBe(300);
  });

  it('brings a new message into view even when scrolled up', () => {
    const frame = frames();
    const turns = streaming('a');
    const { rerender } = render(<MessageList turns={turns} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 100);
    content.height = 1100;
    rerender(<MessageList turns={turns} pending={[steer('p1', 'next', 'steering')]} />);
    expect(viewport.scrollTop).toBe(900);
    expect(screen.queryByRole('button', { name: 'Scroll to bottom' })).toBeNull();
    frame(performance.now() + 240);
    expect(viewport.scrollTop).toBe(900);
  });

  it('keeps a sent prompt at the true bottom through late layout, until the reader scrolls up', () => {
    const callbacks: ResizeObserverCallback[] = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
      observe() {}
      disconnect() {}
    });
    const turns = [first];
    const { rerender } = render(<MessageList turns={turns} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    scrollTo(viewport, 100);
    content.height = 1100;
    rerender(<MessageList turns={turns} pending={[steer('p1', 'next', 'starting')]} />);
    expect(viewport.scrollTop).toBe(900);

    content.height = 1124;
    act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
    expect(viewport.scrollTop).toBe(924);

    scrollTo(viewport, 200);
    content.height = 1148;
    act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
    expect(viewport.scrollTop).toBe(200);
  });

  it('lets a reply fill the follow space so no scroll is left below a sent prompt', () => {
    const frame = frames();
    const turns = [first];
    const { rerender } = render(<MessageList turns={turns} pending={[]} />);
    // Real layout: the content ends at `end`, then the spacer, then the list's 12px padding.
    const layout = { end: 1000 };
    const viewport = document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    const spacer = () => document.querySelector<HTMLElement>('[data-slot="stream-space"]')!;
    const offsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) { return this.dataset.slot === 'stream-space' ? layout.end : 0; },
    });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, get: () => 200 });
    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      get: () => layout.end + (Number.parseFloat(spacer().style.height) || 0) + 12,
    });
    const leftBelow = () => viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
    try {
      layout.end = 1100;
      rerender(<MessageList turns={turns} pending={[steer('p1', 'next', 'starting')]} />);
      frame(performance.now() + 240);
      expect(spacer()).toHaveStyle({ height: '138px' });
      expect(leftBelow()).toBe(0);
      const sentAt = viewport.scrollTop;

      // The server admits it: its footer and the reply's Thinking row grow the content.
      layout.end = 1180;
      rerender(<MessageList turns={[first, turn('p1', 'next', reply('running'))]} pending={[]} />);
      expect(viewport.scrollTop).toBe(sentAt);
      expect(spacer()).toHaveStyle({ height: '58px' });
      expect(leftBelow()).toBe(0);

      // Text reaching the viewport's bottom turns the page, with the whole follow space again.
      layout.end = 1260;
      rerender(<MessageList turns={[first, turn('p1', 'next', reply('running', 'a'))]} pending={[]} />);
      frame(performance.now() + 720);
      expect(spacer()).toHaveStyle({ height: '138px' });
      expect(leftBelow()).toBe(0);
      expect(viewport.scrollTop).toBeGreaterThan(sentAt);
    } finally {
      if (offsetTop) Object.defineProperty(HTMLElement.prototype, 'offsetTop', offsetTop);
      else delete (HTMLElement.prototype as { offsetTop?: number }).offsetTop;
    }
  });

  it('hides the bottom button when only empty follow space remains below', () => {
    const turns = streaming('a');
    const { rerender } = render(<MessageList turns={turns} pending={[]} />);
    const viewport = sized({ height: 1000 });
    rerender(<MessageList turns={[...turns]} pending={[]} />);
    scrollTo(viewport, 100);
    expect(screen.getByRole('button', { name: 'Scroll to bottom' })).toBeInTheDocument();
    scrollTo(viewport, 700);
    expect(screen.queryByRole('button', { name: 'Scroll to bottom' })).toBeNull();
    expect(viewport.scrollTop).toBeLessThan(800);
  });

  it('raises a new message until the whole follow space shows below it', () => {
    const frame = frames();
    const turns = streaming('a');
    const { rerender } = render(<MessageList turns={turns} pending={[]} />);
    const content = { height: 1000 };
    const viewport = sized(content);
    // The content ends 150px down a 200px viewport, so only part of the follow space shows.
    scrollTo(viewport, 700);
    content.height = 1020;
    rerender(<MessageList turns={turns} pending={[steer('p1', 'next', 'steering')]} />);
    frame(performance.now() + 240);
    expect(viewport.scrollTop).toBe(820);
  });

  it('retargets a new message after its follow space renders', () => {
    const frame = frames();
    const turns = streaming('a');
    const { rerender } = render(<MessageList turns={turns} pending={[]} />);
    const viewport = sized({ height: 850 });
    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      get: () => 850 + Number.parseFloat(document.querySelector<HTMLElement>('[data-slot="stream-space"]')?.style.height || '0'),
    });

    rerender(<MessageList turns={turns} pending={[steer('p1', 'next', 'steering')]} />);
    frame(performance.now() + 240);

    expect(viewport.scrollTop).toBe(788);
  });

  it('leaves a chat that fits with its follow space in place', () => {
    const frame = frames();
    const turns = streaming('a');
    const { rerender } = render(<MessageList turns={turns} pending={[]} />);
    const content = { height: 190 };
    const viewport = sized(content);
    rerender(<MessageList turns={turns} pending={[steer('p1', 'next', 'steering')]} />);
    frame(performance.now() + 240);
    expect(viewport.scrollTop).toBe(0);
  });

  it('does not scroll when it re-renders with the same messages', () => {
    const turns = streaming('a');
    const pending: PendingMessage[] = [];
    const { rerender } = render(<MessageList turns={turns} pending={pending} />);
    const viewport = sized({ height: 1000 });
    scrollTo(viewport, 100);
    rerender(<MessageList turns={turns} pending={pending} hasEarlier={false} />);
    expect(viewport.scrollTop).toBe(100);
  });
});

describe('MessageList footers', () => {
  const finished = (): ReplyState => ({
    ...reply('succeeded'),
    steps: [
      {
        id: 'a1',
        parts: [
          { kind: 'text', id: 'a1:text:0', ordinal: 0, text: 'first', done: true },
          { kind: 'tool', id: 't1', name: 'read', status: 'completed', inputText: '', input: {}, metadata: {}, content: [] },
          { kind: 'text', id: 'a1:text:1', ordinal: 1, text: 'pong', done: true },
        ],
        model: { providerID: 'p', modelID: 'model-x', variant: 'high' },
        created: 1000,
        streamed: 3000,
        completed: 3500,
        tokens: { output: 50, reasoning: 0 },
      },
    ],
  });

  it('shows the prompt time and Copy under the prompt', () => {
    const created = Date.UTC(2026, 10, 3, 9, 30);
    setup({ turns: [{ ...turn('m1', 'hello', finished()), created }] });
    const footer = bubble('hello').querySelector('[data-slot="message-footer"]')!;
    expect(footer.querySelector('time')).toHaveAttribute('dateTime', new Date(created).toISOString());
    expect(footer.querySelector('time')).toHaveClass('text-[13px]', 'text-text-secondary');
    expect(within(footer as HTMLElement).getByRole('button', { name: 'Copy message' })).toBeInTheDocument();
    expect(footer.querySelector('svg')).toHaveClass('size-3.5');
  });

  it('puts one footer under the last answer of a finished turn, with model, duration and speed', () => {
    setup({ turns: [{ ...turn('m1', 'hello', finished()), created: 500 }] });
    const footers = document.querySelectorAll('[data-slot="assistant-reply"] [data-slot="message-footer"]');
    expect(footers).toHaveLength(1);
    expect(screen.getByText('pong').closest('[data-footer-host]')).toContainElement(footers[0] as HTMLElement);
    expect(screen.getByText('model-x High · 3s · 25.0 tok/s')).toBeInTheDocument();
    expect(footers[0]!.querySelector('[data-slot="message-meta"]')).toHaveClass('text-[13px]', 'text-text-secondary');
    expect(footers[0]!.querySelector('button')).toHaveClass('text-text-secondary');
  });

  it('has no answer footer while the reply streams', () => {
    setup({ turns: [turn('m1', 'hello', { ...finished(), status: 'running' })] });
    expect(document.querySelector('[data-slot="assistant-reply"] [data-slot="message-footer"]')).toBeNull();
  });

  it('marks a stopped reply with the same divider as a model switch', () => {
    setup({ turns: [turn('m1', 'hello', { ...finished(), status: 'interrupted' })] });
    expect(document.querySelector('[data-slot="reply-interrupted"]')).toHaveTextContent('Stopped before the reply finished.');
  });

  it('copies the answer and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup({ turns: [turn('m1', 'hello', finished())] });
    fireEvent.click(screen.getByRole('button', { name: 'Copy response' }));
    expect(writeText).toHaveBeenCalledWith('pong');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
