import { beforeEach, describe, expect, it } from 'vitest';
import { defaultRoot, extract, type Extracted } from '@/lib/browser/page/extract-page';
import { formatRows } from '@/lib/browser/tools/extract';

beforeEach(() => {
  document.body.innerHTML = '';
});

const rows = (r: ReturnType<typeof extract>) => r as Extracted;

describe('extract', () => {
  it('reads a table with its header, from the table or a cell inside it', () => {
    document.body.innerHTML = `<main><table id="prices"><caption>Prices</caption>
      <thead><tr><th>Item</th><th>Price</th></tr></thead>
      <tbody><tr><td>Kettle</td><td>$20</td></tr><tr><td>Toaster</td><td><input value="$35"></td></tr></tbody></table></main>`;
    const fromCell = rows(extract(document.querySelector('td')!, 10));
    expect(fromCell).toEqual({ kind: 'table', source: 'table#prices "Prices"', columns: ['Item', 'Price'], rows: [['Kettle', '$20'], ['Toaster', '$35']], total: 2 });
    expect(rows(extract(defaultRoot(document), 1)).rows).toEqual([['Kettle', '$20']]);
  });

  it('turns repeated cards into named columns and drops one-off fields', () => {
    const card = (name: string, price: string, extra = '') =>
      `<div class="card"><h3 class="title">${name}</h3><span class="price">${price}</span><a href="/p/${name}">View</a>${extra}</div>`;
    document.body.innerHTML = `<main><h1>Results</h1><section class="grid">${card('Blue', '$20', '<b class="badge">New</b>')}${card('Red', '$25')}${card('Green', '$30')}${card('Gold', '$90')}${card('Teal', '$22')}${card('Pink', '$21')}</section></main>`;
    const r = rows(extract(defaultRoot(document), 10));
    expect(r.kind).toBe('list');
    expect(r.columns).toEqual(['title', 'price', 'a', 'link']);
    expect(r.rows[1]).toEqual(['Red', '$25', 'View', expect.stringMatching(/\/p\/Red$/)]);
    expect(r.total).toBe(6);
  });

  it('says so when there is nothing to extract', () => {
    document.body.innerHTML = '<main><p>Just one paragraph.</p></main>';
    expect(extract(defaultRoot(document), 10)).toEqual({ error: 'INVALID_INPUT', message: expect.stringMatching(/^No table, list or repeated items found in main/) });
  });
});

describe('formatRows', () => {
  const data = { columns: ['name', 'note'], rows: [['Kettle', 'say "hi", ok']] };
  it('writes CSV with quoting, or JSON objects', () => {
    expect(formatRows(data, 'csv')).toBe('name,note\nKettle,"say ""hi"", ok"');
    expect(formatRows(data, 'json')).toBe('[{"name":"Kettle","note":"say \\"hi\\", ok"}]');
  });
});
