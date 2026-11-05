// Trusted input through CDP (design D6): mouse events in CSS pixels of the top viewport
// (Chrome routes them into out-of-process frames), key presses from a key table that
// handles chords like ctrl+a, and text through Input.insertText.

export type CdpSend = (method: string, params?: object) => Promise<unknown>;

const MODIFIER_BITS: Record<string, number> = {
  alt: 1,
  option: 1,
  ctrl: 2,
  control: 2,
  meta: 4,
  cmd: 4,
  command: 4,
  win: 4,
  windows: 4,
  super: 4,
  shift: 8,
};
const MODIFIER_KEYS: Record<number, KeyDef> = {
  1: { key: 'Alt', code: 'AltLeft', keyCode: 18, location: 1 },
  2: { key: 'Control', code: 'ControlLeft', keyCode: 17, location: 1 },
  4: { key: 'Meta', code: 'MetaLeft', keyCode: 91, location: 1 },
  8: { key: 'Shift', code: 'ShiftLeft', keyCode: 16, location: 1 },
};

export type KeyDef = { key: string; code: string; keyCode: number; text?: string; location?: number };

const NAMED: Record<string, KeyDef> = {
  enter: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
  return: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
  tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
  escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
  esc: { key: 'Escape', code: 'Escape', keyCode: 27 },
  backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
  delete: { key: 'Delete', code: 'Delete', keyCode: 46 },
  del: { key: 'Delete', code: 'Delete', keyCode: 46 },
  space: { key: ' ', code: 'Space', keyCode: 32, text: ' ' },
  arrowup: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  arrowdown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  arrowleft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  arrowright: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  home: { key: 'Home', code: 'Home', keyCode: 36 },
  end: { key: 'End', code: 'End', keyCode: 35 },
  pageup: { key: 'PageUp', code: 'PageUp', keyCode: 33 },
  pagedown: { key: 'PageDown', code: 'PageDown', keyCode: 34 },
  insert: { key: 'Insert', code: 'Insert', keyCode: 45 },
};
for (let i = 1; i <= 12; i++) NAMED[`f${i}`] = { key: `F${i}`, code: `F${i}`, keyCode: 111 + i };

const SHIFTED: Record<string, string> = {
  '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  _: '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`',
};
const PUNCT: Record<string, [string, number]> = {
  '-': ['Minus', 189], '=': ['Equal', 187], '[': ['BracketLeft', 219], ']': ['BracketRight', 221], '\\': ['Backslash', 220],
  ';': ['Semicolon', 186], "'": ['Quote', 222], ',': ['Comma', 188], '.': ['Period', 190], '/': ['Slash', 191], '`': ['Backquote', 192],
};

/** The key for a name (`Enter`, `ArrowDown`, `F5`) or a single character. */
export function keyDef(name: string): KeyDef | undefined {
  const named = NAMED[name.toLowerCase()];
  if (named) return named;
  if ([...name].length !== 1) return undefined;
  const ch = name;
  if (/[a-z]/i.test(ch)) return { key: ch, code: `Key${ch.toUpperCase()}`, keyCode: ch.toUpperCase().charCodeAt(0), text: ch };
  if (/[0-9]/.test(ch)) return { key: ch, code: `Digit${ch}`, keyCode: ch.charCodeAt(0), text: ch };
  const base = SHIFTED[ch] ?? ch;
  if (/[0-9]/.test(base)) return { key: ch, code: `Digit${base}`, keyCode: base.charCodeAt(0), text: ch };
  const punct = PUNCT[base];
  if (punct) return { key: ch, code: punct[0], keyCode: punct[1], text: ch };
  return { key: ch, code: '', keyCode: 0, text: ch };
}

export type KeyChord = { modifiers: number; key: KeyDef };

/**
 * `"ctrl+a Backspace"` → chords. Keys are separated by spaces, modifiers joined with `+`
 * (`ctrl+shift+Tab`). A lone `+` is the plus key.
 */
export function parseKeys(text: string): KeyChord[] {
  const chords: KeyChord[] = [];
  for (const token of text.trim().split(/\s+/).filter(Boolean)) {
    const parts = token === '+' ? ['+'] : token.split('+').filter((p, i, all) => p !== '' || i === all.length - 1);
    const keyName = parts.pop()!;
    let modifiers = 0;
    for (const m of parts) {
      const bit = MODIFIER_BITS[m.toLowerCase()];
      if (bit === undefined) throw new Error(`Unknown modifier "${m}" in "${token}". Use ctrl, shift, alt or meta (cmd).`);
      modifiers |= bit;
    }
    const lone = MODIFIER_BITS[keyName.toLowerCase()];
    if (lone !== undefined && parts.length === 0) {
      chords.push({ modifiers: 0, key: MODIFIER_KEYS[lone]! });
      continue;
    }
    const key = keyDef(keyName === '' ? '+' : keyName);
    if (!key) throw new Error(`Unknown key "${keyName}" in "${token}".`);
    chords.push({ modifiers, key });
  }
  return chords;
}

export function parseModifiers(text: string | undefined): number {
  if (!text) return 0;
  return text
    .split('+')
    .filter(Boolean)
    .reduce((bits, m) => {
      const bit = MODIFIER_BITS[m.toLowerCase().trim()];
      if (bit === undefined) throw new Error(`Unknown modifier "${m}". Use ctrl, shift, alt or meta (cmd).`);
      return bits | bit;
    }, 0);
}

const keyEvent = (type: string, key: KeyDef, modifiers: number, withText: boolean) => ({
  type,
  key: key.key,
  code: key.code,
  windowsVirtualKeyCode: key.keyCode,
  nativeVirtualKeyCode: key.keyCode,
  location: key.location ?? 0,
  modifiers,
  ...(withText && key.text ? { text: key.text, unmodifiedText: key.text } : {}),
});

/** Presses one chord: modifiers down, key down/up, modifiers up (as Playwright does). */
export async function pressChord(send: CdpSend, chord: KeyChord): Promise<void> {
  const held: number[] = [];
  let mods = 0;
  for (const bit of [2, 1, 4, 8]) {
    if (!(chord.modifiers & bit)) continue;
    mods |= bit;
    held.push(bit);
    await send('Input.dispatchKeyEvent', keyEvent('rawKeyDown', MODIFIER_KEYS[bit]!, mods, false));
  }
  // Text is only produced without ctrl/alt/meta (shift alone still types).
  const typesText = !!chord.key.text && (chord.modifiers & ~8) === 0;
  await send('Input.dispatchKeyEvent', keyEvent(typesText ? 'keyDown' : 'rawKeyDown', chord.key, chord.modifiers, typesText));
  await send('Input.dispatchKeyEvent', keyEvent('keyUp', chord.key, chord.modifiers, false));
  for (const bit of held.reverse()) {
    mods &= ~bit;
    await send('Input.dispatchKeyEvent', keyEvent('keyUp', MODIFIER_KEYS[bit]!, mods, false));
  }
}

export type MouseButton = 'left' | 'right' | 'middle';
const BUTTON_BITS: Record<MouseButton, number> = { left: 1, right: 2, middle: 4 };

export async function moveMouse(send: CdpSend, x: number, y: number, modifiers = 0, buttons = 0): Promise<void> {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers, buttons, button: buttons ? 'left' : 'none' });
}

/** A click, double click or triple click: one press/release pair per count (clickCount 1..n). */
export async function click(
  send: CdpSend,
  x: number,
  y: number,
  options: { button?: MouseButton; clicks?: number; modifiers?: number } = {},
): Promise<void> {
  const button = options.button ?? 'left';
  const modifiers = options.modifiers ?? 0;
  await moveMouse(send, x, y, modifiers);
  for (let count = 1; count <= (options.clicks ?? 1); count++) {
    const base = { x, y, button, modifiers, clickCount: count };
    await send('Input.dispatchMouseEvent', { ...base, type: 'mousePressed', buttons: BUTTON_BITS[button] });
    await send('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased', buttons: 0 });
  }
}

export async function drag(send: CdpSend, from: [number, number], to: [number, number], steps = 10): Promise<void> {
  await moveMouse(send, from[0], from[1]);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from[0], y: from[1], button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= steps; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / steps;
    const y = from[1] + ((to[1] - from[1]) * i) / steps;
    await moveMouse(send, x, y, 0, 1);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to[0], y: to[1], button: 'left', buttons: 0, clickCount: 1 });
}

const WHEEL_TICK = 100;

export async function wheel(send: CdpSend, x: number, y: number, direction: 'up' | 'down' | 'left' | 'right', ticks: number): Promise<void> {
  const delta = ticks * WHEEL_TICK;
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x,
    y,
    deltaX: direction === 'left' ? -delta : direction === 'right' ? delta : 0,
    deltaY: direction === 'up' ? -delta : direction === 'down' ? delta : 0,
  });
}

export async function insertText(send: CdpSend, text: string): Promise<void> {
  await send('Input.insertText', { text });
}

/** Coordinates in a screenshot's frame → CSS pixels of the viewport (design D8). */
export function toViewport(point: [number, number], frame: { frameW: number; frameH: number; cssW: number; cssH: number } | undefined): [number, number] {
  if (!frame) return point;
  return [(point[0] * frame.cssW) / frame.frameW, (point[1] * frame.cssH) / frame.frameH];
}
