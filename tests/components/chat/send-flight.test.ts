import { afterEach, describe, expect, it, vi } from 'vitest';
import { launchSendFlight } from '@/components/chat/send-flight';

describe('send flight', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.querySelectorAll('[data-message-id], [data-send-ghost]').forEach((element) => element.remove());
  });

  it('reuses its mounted target during the flight and finds a replacement after remount', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let next = 0;
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.set(++next, callback);
      return next;
    });
    const frame = (time: number) => {
      const queued = [...callbacks.values()];
      callbacks.clear();
      queued.forEach((callback) => callback(time));
    };
    const bubble = (left: number) => {
      const element = document.createElement('div');
      element.dataset.messageId = 'flight-target';
      element.className = 'rounded-2xl px-3 py-2';
      element.getBoundingClientRect = () => ({ left, top: 100, width: 120, height: 30 } as DOMRect);
      document.body.append(element);
      return element;
    };
    const first = bubble(100);
    const query = vi.spyOn(document, 'querySelector');
    const start = performance.now();
    launchSendFlight({ id: 'flight-target', from: { left: 0, top: 0 } });
    frame(start + 16);
    expect(document.querySelector('[data-send-ghost]')).toBeInTheDocument();
    query.mockClear();
    frame(start + 80);
    frame(start + 120);
    expect(query).not.toHaveBeenCalled();
    first.remove();
    bubble(140);
    frame(start + 180);
    expect(query).toHaveBeenCalledTimes(1);
    frame(start + 300);
    expect(document.querySelector('[data-send-ghost]')).not.toBeInTheDocument();
  });

  it('flies a long prompt in already collapsed, with its toggle line and no live text', () => {
    let pending: FrameRequestCallback | undefined;
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pending = callback;
      return 1;
    });
    const element = document.createElement('div');
    element.dataset.messageId = 'long';
    element.className = 'flex flex-col px-3 py-2 invisible';
    element.innerHTML =
      '<div data-collapsible="closed" class="collapsible-text overflow-hidden" style="height: 144px"><p class="whitespace-pre-wrap">line one\nline two</p></div><button type="button" class="mt-1 text-xs">Show more</button>';
    document.body.append(element);

    launchSendFlight({ id: 'long', from: { left: 0, top: 0 } });
    pending?.(performance.now());

    const ghost = document.querySelector<HTMLElement>('[data-send-ghost]');
    expect(ghost).not.toHaveClass('invisible');
    const clamp = ghost?.querySelector<HTMLElement>('[data-collapsible="closed"]');
    expect(clamp).toHaveClass('collapsible-text');
    expect(clamp?.style.height).toBe('144px');
    expect(clamp?.querySelector('.whitespace-pre-wrap')).toHaveAttribute('data-text', 'line one\nline two');
    expect(ghost?.querySelector('.text-xs')).toHaveAttribute('data-text', 'Show more');
    expect(ghost?.querySelector('button')).toBeNull();
    expect(ghost?.textContent).toBe('');
  });
});
