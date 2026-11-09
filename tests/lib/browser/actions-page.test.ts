import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fill, focusedInfo, locate, setFiles } from '@/lib/browser/page/actions-page';
import { ElementRegistry } from '@/lib/browser/snapshot/walker';

let registry: ElementRegistry;
beforeEach(() => {
  document.body.innerHTML = '';
  registry = new ElementRegistry();
});

const ref = (selector: string) => registry.idOf(document.querySelector(selector)!);

/** happy-dom has no layout: give an element a box and make it the hit-test result. */
function box(el: Element, rect: { left: number; top: number; width: number; height: number }) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    ...rect,
    x: rect.left,
    y: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('locate', () => {
  it('returns the centre of the visible box and what the element is', () => {
    document.body.innerHTML = '<form><button type="submit">Submit order</button></form>';
    const button = document.querySelector('button')!;
    box(button, { left: 10, top: 20, width: 100, height: 40 });
    document.elementFromPoint = vi.fn(() => button);
    expect(locate(registry, document, ref('button'))).toMatchObject({
      x: 60,
      y: 40,
      label: 'button "Submit order"',
      submits: true,
      inForm: true,
      secret: null,
    });
  });

  it('names the element covering the target', () => {
    document.body.innerHTML = '<button>Buy</button><div id="cookie-banner" role="region" aria-label="Cookie consent"><span>We use cookies</span></div>';
    const button = document.querySelector('button')!;
    box(button, { left: 0, top: 0, width: 50, height: 20 });
    document.elementFromPoint = vi.fn(() => document.querySelector('span')!);
    expect(locate(registry, document, ref('button'))).toEqual({
      error: 'OBSCURED',
      message: 'button "Buy" is covered by region "Cookie consent" (div#cookie-banner). Close or accept that first (find its button), then try again.',
    });
  });

  it('refuses disabled, zero-size and removed elements', () => {
    document.body.innerHTML = '<button disabled>Pay</button><button id="z">Zero</button>';
    const pay = document.querySelector('button')!;
    box(pay, { left: 0, top: 0, width: 50, height: 20 });
    expect(locate(registry, document, ref('button'))).toMatchObject({ error: 'NOT_INTERACTABLE', message: expect.stringMatching(/^button "Pay" is disabled\. Something must be done first/) });
    expect(locate(registry, document, ref('#z'))).toMatchObject({ error: 'NOT_INTERACTABLE' });
    const gone = ref('#z');
    document.querySelector('#z')!.remove();
    expect(locate(registry, document, gone)).toMatchObject({ error: 'STALE_REF' });
  });

  it('flags password, one-time-code and card fields', () => {
    document.body.innerHTML = `
      <input id="p" type="password" aria-label="Password">
      <input id="o" autocomplete="one-time-code" aria-label="Code">
      <input id="c" name="card_number" aria-label="Card number">`;
    for (const id of ['#p', '#o', '#c']) box(document.querySelector(id)!, { left: 0, top: 0, width: 50, height: 20 });
    document.elementFromPoint = vi.fn((_x, _y) => null);
    expect(locate(registry, document, ref('#p'), false)).toMatchObject({ secret: 'password' });
    expect(locate(registry, document, ref('#o'), false)).toMatchObject({ secret: 'otp' });
    expect(locate(registry, document, ref('#c'), false)).toMatchObject({ secret: 'card' });
  });
});

describe('fill', () => {
  it('sets a text field through the native setter and fires input and change', () => {
    document.body.innerHTML = '<label>City <input value="Delhi"></label>';
    const input = document.querySelector('input')!;
    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));
    expect(fill(registry, ref('input'), 'Pune')).toEqual({ label: 'textbox "City"', previous: 'Delhi', value: 'Pune' });
    expect(input.value).toBe('Pune');
    expect(events).toEqual(['input', 'change']);
  });

  it('picks select options by value or visible text and lists options when none match', () => {
    document.body.innerHTML = '<select aria-label="Crust"><option value="thin">Thin</option><option value="deep">Deep dish</option></select>';
    expect(fill(registry, ref('select'), 'Deep dish')).toEqual({ label: 'combobox "Crust"', previous: 'Thin', value: 'Deep dish' });
    expect(fill(registry, ref('select'), 'thin')).toMatchObject({ value: 'Thin' });
    expect(fill(registry, ref('select'), 'stuffed')).toEqual({
      error: 'INVALID_INPUT',
      message: 'combobox "Crust" has no option "stuffed". Options: "Thin" ("thin"), "Deep dish" ("deep").',
    });
  });

  it('ticks checkboxes with a click and refuses to unselect a radio', () => {
    document.body.innerHTML = '<label><input type="checkbox"> Cheese</label><label><input type="radio" name="s"> Small</label>';
    const clicks = vi.fn();
    document.querySelector('input')!.addEventListener('click', clicks);
    expect(fill(registry, ref('input[type=checkbox]'), true)).toEqual({ label: 'checkbox "Cheese"', previous: 'false', value: 'true' });
    expect(clicks).toHaveBeenCalledTimes(1);
    expect(fill(registry, ref('input[type=radio]'), false)).toMatchObject({ error: 'INVALID_INPUT' });
    expect(fill(registry, ref('input[type=radio]'), true)).toMatchObject({ value: 'true' });
  });

  it('masks password values and sends file inputs to file_upload', () => {
    document.body.innerHTML = '<input type="password" aria-label="PW" value="old"><input type="file" aria-label="Doc">';
    expect(fill(registry, ref('input[type=password]'), 'new-secret')).toEqual({ label: 'textbox "PW"', previous: '•••', value: '•••' });
    expect(fill(registry, ref('input[type=file]'), 'x')).toMatchObject({ error: 'INVALID_INPUT', message: expect.stringContaining('file_upload') });
  });

  it('fills a contenteditable region', () => {
    document.body.innerHTML = '<div contenteditable="true" aria-label="Editor">old</div>';
    expect(fill(registry, ref('div'), 'new text')).toMatchObject({ previous: 'old', value: 'new text' });
  });
});

describe('setFiles and focusedInfo', () => {
  it('puts files into a file input and fires change', () => {
    document.body.innerHTML = '<input type="file" aria-label="Resume">';
    const change = vi.fn();
    document.querySelector('input')!.addEventListener('change', change);
    const result = setFiles(registry, ref('input'), [{ name: 'cv.txt', type: 'text/plain', base64: btoa('hello') }]);
    expect(result).toEqual({ label: 'button "Resume"', names: ['cv.txt'] });
    expect(change).toHaveBeenCalled();
  });

  it('refuses non-file inputs and several files for a single input', () => {
    document.body.innerHTML = '<input aria-label="Name"><input type="file" aria-label="One">';
    expect(setFiles(registry, ref('input:not([type])'), [])).toMatchObject({ error: 'INVALID_INPUT' });
    const two = [1, 2].map((i) => ({ name: `${i}.txt`, type: 'text/plain', base64: btoa('x') }));
    expect(setFiles(registry, ref('input[type=file]'), two)).toMatchObject({ error: 'INVALID_INPUT', message: expect.stringContaining('accepts one file') });
  });

  it('describes the focused element', () => {
    document.body.innerHTML = '<form><input type="password" aria-label="Password"></form>';
    document.querySelector('input')!.focus();
    expect(focusedInfo(document)).toEqual({ label: 'textbox "Password"', secret: 'password', editable: true, inForm: true });
  });
});
