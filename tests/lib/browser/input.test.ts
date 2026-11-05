import { describe, expect, it } from 'vitest';
import { click, keyDef, parseKeys, parseModifiers, pressChord, toViewport, wheel } from '@/lib/browser/input';

const recorder = () => {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const send = async (method: string, params?: object) => {
    calls.push({ method, params: params as Record<string, unknown> });
    return {};
  };
  return { calls, send };
};

describe('parseKeys', () => {
  it('parses chords, names and repeats of single keys', () => {
    expect(parseKeys('ctrl+a Backspace')).toEqual([
      { modifiers: 2, key: { key: 'a', code: 'KeyA', keyCode: 65, text: 'a' } },
      { modifiers: 0, key: { key: 'Backspace', code: 'Backspace', keyCode: 8 } },
    ]);
    expect(parseKeys('ctrl+shift+Tab')[0]!.modifiers).toBe(2 | 8);
    expect(parseKeys('cmd+Enter')[0]).toMatchObject({ modifiers: 4, key: { key: 'Enter' } });
    expect(parseKeys('+')[0]!.key.key).toBe('+');
    expect(parseKeys('ctrl++')[0]).toMatchObject({ modifiers: 2, key: { key: '+', code: 'Equal' } });
    expect(parseKeys('Shift')[0]!.key.key).toBe('Shift');
  });

  it('rejects unknown keys and modifiers with a clear message', () => {
    expect(() => parseKeys('hyper+a')).toThrow('Unknown modifier "hyper"');
    expect(() => parseKeys('Launchpad')).toThrow('Unknown key "Launchpad"');
  });
});

describe('keyDef', () => {
  it.each([
    ['Enter', { key: 'Enter', keyCode: 13, text: '\r' }],
    ['F5', { key: 'F5', keyCode: 116 }],
    ['7', { key: '7', code: 'Digit7', keyCode: 55 }],
    ['?', { key: '?', code: 'Slash', keyCode: 191 }],
    ['ArrowDown', { key: 'ArrowDown', keyCode: 40 }],
  ])('%s', (name, expected) => expect(keyDef(name)).toMatchObject(expected));
});

describe('pressChord', () => {
  it('holds modifiers around a raw key press without text', async () => {
    const r = recorder();
    await pressChord(r.send, parseKeys('ctrl+a')[0]!);
    expect(r.calls.map((c) => `${c.params.type}:${c.params.key}:${c.params.modifiers}:${c.params.text ?? ''}`)).toEqual([
      'rawKeyDown:Control:2:',
      'rawKeyDown:a:2:',
      'keyUp:a:2:',
      'keyUp:Control:0:',
    ]);
  });

  it('types text for a plain or shifted character', async () => {
    const r = recorder();
    await pressChord(r.send, parseKeys('Enter')[0]!);
    expect(r.calls[0]!.params).toMatchObject({ type: 'keyDown', key: 'Enter', text: '\r' });
  });
});

describe('mouse', () => {
  it('sends one press/release pair per click count', async () => {
    const r = recorder();
    await click(r.send, 10, 20, { clicks: 2, modifiers: parseModifiers('shift') });
    expect(r.calls.map((c) => `${c.params.type}:${c.params.clickCount ?? ''}`)).toEqual([
      'mouseMoved:',
      'mousePressed:1',
      'mouseReleased:1',
      'mousePressed:2',
      'mouseReleased:2',
    ]);
    expect(r.calls[1]!.params).toMatchObject({ x: 10, y: 20, button: 'left', modifiers: 8, buttons: 1 });
  });

  it('scrolls with wheel ticks', async () => {
    const r = recorder();
    await wheel(r.send, 5, 5, 'down', 3);
    expect(r.calls[0]!.params).toMatchObject({ type: 'mouseWheel', deltaY: 300, deltaX: 0 });
  });
});

describe('toViewport', () => {
  it('maps screenshot frame coordinates to CSS pixels', () => {
    expect(toViewport([784, 372], { frameW: 1568, frameH: 744, cssW: 1920, cssH: 911 })).toEqual([960, 455.5]);
    expect(toViewport([5, 6], undefined)).toEqual([5, 6]);
  });
});
