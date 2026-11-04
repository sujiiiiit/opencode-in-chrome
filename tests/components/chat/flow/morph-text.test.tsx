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

  const line = () => document.querySelector<HTMLElement>('[data-slot="line"]')!;

  it('fades the old words out, then the new ones in, with one text on screen throughout', () => {
    const view = render(<MorphText id="a" text="Reading main.ts" textSlot="line" />);
    view.rerender(<MorphText id="b" text="Reading app.tsx" textSlot="line" />);
    expect(line()).toHaveAttribute('data-phase', 'out');
    expect(line()).toHaveClass('morph-out');
    expect(line()).toHaveTextContent('Reading main.ts');
    act(() => vi.advanceTimersByTime(120));
    expect(line()).toHaveAttribute('data-phase', 'in');
    expect(line()).toHaveClass('morph-in');
    expect(line()).toHaveTextContent('Reading app.tsx');
    act(() => vi.advanceTimersByTime(200));
    expect(line()).not.toHaveAttribute('data-phase');
    // Only the visible line carries text; the width ruler draws through ::before.
    expect(view.container.textContent).toBe('Reading app.tsx');
  });

  it('lands on the newest label when it changes again mid-swap', () => {
    const view = render(<MorphText id="a" text="Thinking" textSlot="line" />);
    view.rerender(<MorphText id="b" text="Reading a.ts" textSlot="line" />);
    view.rerender(<MorphText id="c" text="Reading b.ts" textSlot="line" />);
    act(() => vi.advanceTimersByTime(120));
    expect(line()).toHaveTextContent('Reading b.ts');
    act(() => vi.advanceTimersByTime(200));
    expect(line()).not.toHaveAttribute('data-phase');
  });

  it('follows new text under the same id without a swap', () => {
    const view = render(<MorphText id="a" text="Planning" textSlot="line" />);
    view.rerender(<MorphText id="a" text="Planning the fix" textSlot="line" />);
    expect(line()).toHaveTextContent('Planning the fix');
    expect(line()).not.toHaveAttribute('data-phase');
  });
});
