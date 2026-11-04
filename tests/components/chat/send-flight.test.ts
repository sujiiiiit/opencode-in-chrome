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
    launchSendFlight({ id: 'flight-target', text: 'hello', from: { left: 0, top: 0 } });
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
});
