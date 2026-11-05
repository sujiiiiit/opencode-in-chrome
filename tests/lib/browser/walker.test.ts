import { beforeEach, describe, expect, it } from 'vitest';
import { ElementRegistry, pageText, walk } from '@/lib/browser/snapshot/walker';

let registry: ElementRegistry;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.title = 'Fixture';
  registry = new ElementRegistry();
});

const lines = (opts: Parameters<typeof walk>[2] = {}) => walk(document, registry, opts).lines;

describe('walk: names, roles and refs', () => {
  it('names inputs from their labels and lists buttons', () => {
    document.body.innerHTML = `
      <form>
        <label>Customer name: <input name="custname"></label>
        <label for="tel">Telephone</label><input id="tel" type="tel">
        <input placeholder="Search docs" type="search">
        <button type="submit">Submit order</button>
      </form>`;
    expect(lines()).toEqual([
      'textbox "Customer name:" [@1]',
      'textbox "Telephone" [@2] type="tel"',
      'searchbox "Search docs" [@3] type="search"',
      'button "Submit order" [@4]',
    ]);
  });

  it('uses aria-label, aria-labelledby, alt and role attributes', () => {
    document.body.innerHTML = `
      <span id="lbl">Close dialog</span>
      <div role="button" tabindex="0" aria-labelledby="lbl">x</div>
      <a href="/next" aria-label="Next page">→</a>
      <div role="button" onclick="void 0">Div button</div>`;
    expect(lines()).toEqual([
      'button "Close dialog" [@1]',
      'link "Next page" [@2] href="/next"',
      'button "Div button" [@3]',
    ]);
  });

  it('keeps the same number for the same element across walks and new numbers for new ones', () => {
    document.body.innerHTML = '<button>A</button><button>B</button>';
    expect(lines()).toEqual(['button "A" [@1]', 'button "B" [@2]']);
    document.body.insertAdjacentHTML('afterbegin', '<button>New</button>');
    expect(lines()).toEqual(['button "New" [@3]', 'button "A" [@1]', 'button "B" [@2]']);
    const b = document.querySelectorAll('button')[2]!;
    b.remove();
    expect(registry.get(2)).toBeUndefined();
    expect(registry.get(1)?.textContent).toBe('A');
  });
});

describe('walk: state', () => {
  it('reports checked, values, selects, disabled, required and focus', () => {
    document.body.innerHTML = `
      <label><input type="checkbox" checked> Cheese</label>
      <label><input type="radio" name="s" disabled> Small</label>
      <input aria-label="City" value="Pune" required>
      <textarea aria-label="Notes">ring bell</textarea>
      <select aria-label="Crust"><option value="thin">Thin</option><option value="deep" selected>Deep dish</option></select>
      <button aria-expanded="false">Menu</button>`;
    (document.querySelector('textarea') as HTMLTextAreaElement).focus();
    expect(lines()).toEqual([
      'checkbox "Cheese" [@1] (checked)',
      'radio "Small" [@2] (disabled)',
      'textbox "City" [@3] value="Pune" (required)',
      'textbox "Notes" [@4] value="ring bell" (focused)',
      'combobox "Crust" [@5] value="Deep dish"',
      ' option "Thin" value="thin"',
      ' option "Deep dish" value="deep" (selected)',
      'button "Menu" [@6] (collapsed)',
    ]);
  });

  it('masks password values', () => {
    document.body.innerHTML = '<input type="password" aria-label="Password" value="hunter2">';
    expect(lines()).toEqual(['textbox "Password" [@1] type="password" value=•••']);
    expect(lines().join('\n')).not.toContain('hunter2');
  });

  it('shows contenteditable regions as textboxes with their text', () => {
    document.body.innerHTML = '<div contenteditable="true" aria-label="Editor">edit me</div>';
    expect(lines()).toEqual(['textbox "Editor" [@1] value="edit me"']);
  });
});

describe('walk: filters', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <h1>Order a pizza</h1>
        <p>Pick a size. <button>Go</button></p>
        <button style="display:none">Hidden btn</button>
        <div hidden><button>Inside hidden</button></div>
      </main>`;
  });

  it('interactive skips hidden elements and structure', () => {
    expect(lines()).toEqual(['button "Go" [@1]']);
  });

  it('all includes structure, text and hidden elements marked (hidden), indented by kept depth', () => {
    expect(lines({ filter: 'all' })).toEqual([
      'main',
      ' heading "Order a pizza" level=1',
      ' paragraph "Pick a size."',
      '  button "Go" [@1]',
      ' button "Hidden btn" [@2] (hidden)',
      ' generic (hidden)',
    ]);
  });

  it('limits depth and reads a subtree by ref', () => {
    expect(lines({ filter: 'all', depth: 1 })).toEqual(['main']);
    document.body.insertAdjacentHTML('beforeend', '<form><button>In form</button></form><button>Outside</button>');
    lines();
    const formButton = registry.idOf(document.querySelector('form button')!);
    const form = registry.idOf(document.querySelector('form')!);
    expect(lines({ rootRef: form })).toEqual([`button "In form" [@${formButton}]`]);
  });
});

describe('walk: shadow DOM and frames', () => {
  it('walks open shadow roots and closed ones through shadowRootOf', () => {
    const open = document.createElement('div');
    open.attachShadow({ mode: 'open' }).innerHTML = '<button aria-label="Shadow Save">S</button><input placeholder="shadow input">';
    const closedHost = document.createElement('div');
    const closed = closedHost.attachShadow({ mode: 'closed' });
    closed.innerHTML = '<button>Closed shadow btn</button>';
    document.body.append(open, closedHost);
    expect(lines()).toEqual(['button "Shadow Save" [@1]', 'textbox "shadow input" [@2]']);
    expect(lines({ shadowRootOf: (el) => (el === closedHost ? closed : null) })).toEqual([
      'button "Shadow Save" [@1]',
      'textbox "shadow input" [@2]',
      'button "Closed shadow btn" [@3]',
    ]);
  });

  it('renders slotted light DOM in place', () => {
    const host = document.createElement('div');
    host.innerHTML = '<button slot="a">Slotted</button>';
    host.attachShadow({ mode: 'open' }).innerHTML = '<nav><slot name="a"></slot></nav>';
    document.body.append(host);
    expect(lines()).toEqual(['button "Slotted" [@1]']);
  });

  it('marks iframes with the URL their frame loads and does not descend into them', () => {
    document.body.innerHTML = '<iframe title="Payment" src="https://pay.example/"></iframe><iframe srcdoc="<b>x</b>"></iframe>';
    expect(lines()).toEqual([
      `iframe "Payment" [@1] src="https://pay.example/" {iframe:${encodeURIComponent('https://pay.example/')}}`,
      'iframe [@2] {iframe:about%3Asrcdoc}',
    ]);
  });
});

describe('walk: caps', () => {
  it('stops at maxNodes and reports capped', () => {
    document.body.innerHTML = Array.from({ length: 6000 }, (_, i) => `<button>b${i}</button>`).join('');
    const result = walk(document, registry, { maxNodes: 5000, timeBudgetMs: 60_000 });
    expect(result.lines).toHaveLength(5000);
    expect(result.capped).toBe(true);
  });

  it('stops when the time budget runs out', () => {
    document.body.innerHTML = Array.from({ length: 1000 }, (_, i) => `<button>b${i}</button>`).join('');
    let t = 0;
    // The clock is read at start and every 200 elements; each read advances it 5 ms.
    const result = walk(document, registry, { timeBudgetMs: 10, now: () => (t += 5) });
    expect(result.capped).toBe(true);
    expect(result.lines.length).toBeLessThan(1000);
  });
});

describe('pageText', () => {
  it('prefers the main element and collapses whitespace', () => {
    document.body.innerHTML = '<nav>Menu Home About</nav><main><h1>Title</h1>\n\n\n<p>Para   one.</p><p>Para two.</p></main>';
    const result = pageText(document);
    expect(result.source).toBe('<main>');
    expect(result.text).not.toContain('Menu');
    expect(result.text).toMatch(/Title[\s\S]*Para one\.[\s\S]*Para two\./);
  });
});
