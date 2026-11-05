import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MorphText, sharedPrefix } from '@/components/chat/flow/morph-text';

describe('sharedPrefix', () => {
  it('keeps whole shared words only', () => {
    expect(sharedPrefix('Reading main.ts', 'Reading app.tsx')).toBe('Reading '.length);
    expect(sharedPrefix('Reading main.ts', 'Reading main.tsx')).toBe('Reading '.length);
    expect(sharedPrefix('Searching for "x"', 'Searching the web for "x"')).toBe('Searching '.length);
    expect(sharedPrefix('Searching', 'Searching for "x"')).toBe('Searching'.length);
    expect(sharedPrefix('Thinking', 'Reading a.ts')).toBe(0);
    expect(sharedPrefix('Running', 'Ran ls')).toBe(0);
  });
});

describe('MorphText', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const SETTLE = 180;
  const OUT = 160;
  const IN = 240;
  const HOLD = 600;
  const line = () => document.querySelector<HTMLElement>('[data-slot="line"]')!;
  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it('lets a new label settle, then fades the old words out and the new ones in, one text at a time', () => {
    const view = render(<MorphText id="a" text="Reading main.ts" textSlot="line" steady />);
    view.rerender(<MorphText id="b" text="Reading app.tsx" textSlot="line" steady />);
    expect(line()).not.toHaveAttribute('data-phase');
    expect(line()).toHaveTextContent('Reading main.ts');
    advance(SETTLE);
    expect(line()).toHaveAttribute('data-phase', 'out');
    expect(line()).toHaveClass('morph-out');
    // "Reading " stays still, so only the tail fades: the line itself does not blur.
    expect(line()).not.toHaveAttribute('data-whole');
    expect(line()).toHaveTextContent('Reading main.ts');
    advance(OUT);
    expect(line()).toHaveAttribute('data-phase', 'in');
    expect(line()).toHaveClass('morph-in');
    expect(line()).toHaveTextContent('Reading app.tsx');
    advance(IN);
    expect(line()).not.toHaveAttribute('data-phase');
    // Only the visible line carries text; the width ruler draws through ::before.
    expect(view.container.textContent).toBe('Reading app.tsx');
  });

  it('blurs the whole line when no word is shared', () => {
    const view = render(<MorphText id="a" text="Thinking" textSlot="line" steady />);
    view.rerender(<MorphText id="b" text="Reading a.ts" textSlot="line" steady />);
    advance(SETTLE);
    expect(line()).toHaveAttribute('data-whole');
  });

  it('never shows a label that is gone before it settles', () => {
    const view = render(<MorphText id="thinking:1" text="Thinking" textSlot="line" steady />);
    view.rerender(<MorphText id="tool:1" text="Reading a.ts" textSlot="line" steady />);
    advance(SETTLE / 2);
    view.rerender(<MorphText id="thinking:2" text="Thinking" textSlot="line" steady />);
    expect(line()).not.toHaveAttribute('data-phase');
    advance(SETTLE + OUT + IN);
    expect(line()).not.toHaveAttribute('data-phase');
    expect(line()).toHaveTextContent('Thinking');
  });

  it('eases back when the label returns mid-fade', () => {
    const view = render(<MorphText id="thinking:1" text="Thinking" textSlot="line" steady />);
    view.rerender(<MorphText id="tool:1" text="Reading a.ts" textSlot="line" steady />);
    advance(SETTLE);
    expect(line()).toHaveAttribute('data-phase', 'out');
    view.rerender(<MorphText id="thinking:2" text="Thinking" textSlot="line" steady />);
    expect(line()).not.toHaveAttribute('data-phase');
    expect(line()).toHaveTextContent('Thinking');
  });

  it('holds a label that just appeared before swapping again', () => {
    const view = render(<MorphText id="a" text="Thinking" textSlot="line" steady />);
    view.rerender(<MorphText id="b" text="Reading a.ts" textSlot="line" steady />);
    advance(SETTLE);
    advance(OUT);
    advance(IN);
    view.rerender(<MorphText id="c" text="Running ls" textSlot="line" steady />);
    advance(SETTLE);
    expect(line()).not.toHaveAttribute('data-phase');
    advance(HOLD - SETTLE);
    expect(line()).toHaveAttribute('data-phase', 'out');
  });

  it('lands on the newest label when it changes again mid-swap', () => {
    const view = render(<MorphText id="a" text="Thinking" textSlot="line" steady />);
    view.rerender(<MorphText id="b" text="Reading a.ts" textSlot="line" steady />);
    advance(SETTLE);
    view.rerender(<MorphText id="c" text="Reading b.ts" textSlot="line" steady />);
    advance(OUT);
    expect(line()).toHaveTextContent('Reading b.ts');
    advance(IN);
    expect(line()).not.toHaveAttribute('data-phase');
  });

  it('starts the swap at once for text that is not steady', () => {
    const view = render(<MorphText id="a" text="New chat" textSlot="line" />);
    view.rerender(<MorphText id="b" text="Fix login" textSlot="line" />);
    expect(line()).toHaveAttribute('data-phase', 'out');
  });

  it('follows new text under the same id without a swap', () => {
    const view = render(<MorphText id="a" text="Planning" textSlot="line" steady />);
    view.rerender(<MorphText id="a" text="Planning the fix" textSlot="line" steady />);
    expect(line()).toHaveTextContent('Planning the fix');
    expect(line()).not.toHaveAttribute('data-phase');
  });
});
