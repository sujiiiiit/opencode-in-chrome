import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DropOverlay } from '@/components/chat/drop-overlay';
import { LEAVE_GRACE_MS, useFileDrop } from '@/components/chat/use-file-drop';
import { dragEvent, fileOf, transfer } from '@/tests/support/transfer';

const send = (event: Event) => {
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

function setup(enabled = true) {
  const onFiles = vi.fn();
  const hook = renderHook(({ on }) => useFileDrop(onFiles, on), { initialProps: { on: enabled } });
  return { onFiles, hook, dragging: () => hook.result.current };
}

describe('useFileDrop', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows while files are dragged over the panel and accepts them as a copy', () => {
    const { dragging } = setup();
    const data = transfer({ files: [fileOf('a.png')] });
    const enter = send(dragEvent('dragenter', data));
    expect(dragging()).toBe(true);
    const over = send(dragEvent('dragover', data));
    expect(over.defaultPrevented).toBe(true);
    expect(enter.defaultPrevented).toBe(true);
    expect(data.dropEffect).toBe('copy');
  });

  it('attaches the dropped files and hides, without the browser opening them', () => {
    const { onFiles, dragging } = setup();
    const files = [fileOf('a.png'), fileOf('b.jpg', 'image/jpeg')];
    send(dragEvent('dragover', transfer({ files })));
    const drop = send(dragEvent('drop', transfer({ files })));
    expect(drop.defaultPrevented).toBe(true);
    expect(onFiles).toHaveBeenCalledWith(files);
    expect(dragging()).toBe(false);
  });

  it('reads a drop that fills only the files list', () => {
    const { onFiles } = setup();
    const file = fileOf('a.png');
    send(dragEvent('drop', transfer({ files: [file], filesOnly: true })));
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('stays up while the drag moves between the panel elements (no flicker)', () => {
    const { dragging } = setup();
    const data = transfer({ files: [fileOf('a.png')] });
    send(dragEvent('dragover', data));
    // Leaving one element for another names the element entered.
    send(dragEvent('dragleave', data, document.body));
    expect(dragging()).toBe(true);
    // A leave that names nothing, followed at once by a dragover, is still inside the panel.
    send(dragEvent('dragleave', data));
    act(() => vi.advanceTimersByTime(LEAVE_GRACE_MS / 2));
    send(dragEvent('dragover', data));
    act(() => vi.advanceTimersByTime(LEAVE_GRACE_MS * 2));
    expect(dragging()).toBe(true);
  });

  it('hides when the drag leaves the window or is cancelled with Escape', () => {
    const { dragging } = setup();
    const data = transfer({ files: [fileOf('a.png')] });
    send(dragEvent('dragover', data));
    send(dragEvent('dragleave', data));
    expect(dragging()).toBe(true);
    act(() => vi.advanceTimersByTime(LEAVE_GRACE_MS));
    expect(dragging()).toBe(false);
  });

  it('hides when a drag started in the page ends', () => {
    const { dragging } = setup();
    send(dragEvent('dragover', transfer({ files: [fileOf('a.png')] })));
    send(dragEvent('dragend', null));
    expect(dragging()).toBe(false);
  });

  it('leaves text and links dragged within the page alone', () => {
    const { onFiles, dragging } = setup();
    const text = transfer({ text: 'some words', types: ['text/html'] });
    const over = send(dragEvent('dragover', text));
    const drop = send(dragEvent('drop', text));
    expect(dragging()).toBe(false);
    expect(over.defaultPrevented).toBe(false);
    expect(drop.defaultPrevented).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('while disabled (History on screen) shows nothing, takes nothing, but still stops the browser opening the file', () => {
    const { onFiles, dragging } = setup(false);
    const data = transfer({ files: [fileOf('a.png')] });
    send(dragEvent('dragover', data));
    expect(dragging()).toBe(false);
    expect(data.dropEffect).toBe('none');
    const drop = send(dragEvent('drop', data));
    expect(drop.defaultPrevented).toBe(true);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('hides when it becomes disabled mid-drag, and stops listening once unmounted', () => {
    const { onFiles, hook, dragging } = setup();
    send(dragEvent('dragover', transfer({ files: [fileOf('a.png')] })));
    hook.rerender({ on: false });
    expect(dragging()).toBe(false);
    hook.unmount();
    const drop = send(dragEvent('drop', transfer({ files: [fileOf('a.png')] })));
    expect(drop.defaultPrevented).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
  });
});

describe('DropOverlay', () => {
  it('shows "Add anything" only while visible, and never takes the pointer', () => {
    const { container, rerender } = render(<DropOverlay visible={false} />);
    const overlay = container.querySelector('[data-slot="drop-overlay"]')!;
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(overlay).not.toHaveAttribute('data-visible');
    expect(overlay.className).toContain('pointer-events-none');
    rerender(<DropOverlay visible />);
    expect(overlay).toHaveAttribute('data-visible');
    expect(screen.getByText('Add anything')).toBeInTheDocument();
    expect(screen.getByText('Drop any file here to add it to the conversation')).toBeInTheDocument();
  });
});
