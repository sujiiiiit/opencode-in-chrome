import { expect, openPage, refOf, test } from './fixtures';

test('extract returns product cards as CSV rows with named columns', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/shop.html'));
  const all = await tool('extract');
  expect(all.isError).toBeFalsy();
  expect(all.text).toMatch(/^List ul.*: 3 row\(s\)\./);
  expect(all.text).toContain('h2,price,button\nRed kettle,$24.00,Add to cart\nBlue kettle,$31.50,Add to cart\nSteel kettle,$45.00,Add to cart');

  const ref = refOf((await tool('find', { query: 'Blue kettle add to cart button' })).text, /Add to cart/);
  const json = await tool('extract', { ref, format: 'json', max_rows: 1 });
  expect(json.text).toContain('3 row(s), showing 1.');
  expect(json.text).toContain('[{"h2":"Red kettle","price":"$24.00","button":"Add to cart"}]');
});
