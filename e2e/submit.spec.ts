// The fixture server records what pages post to /submit, so goal tasks can be graded on
// what really reached the server rather than on what the agent says it did.
import { expect, test } from './fixtures';

test('a form posted to /submit is recorded with its body', async ({ context, pages }) => {
  const page = await context.newPage();
  await page.setContent('<form method="post"><input name="message" value="see you thursday"><button>Send</button></form>');
  await page.evaluate((action) => (document.querySelector('form')!.action = action), pages.url('/submit/mail'));
  await page.click('button');
  await expect(page.locator('#status')).toHaveText('Your submission was received.');
  expect(pages.submissions()).toEqual([expect.objectContaining({ path: '/submit/mail', body: 'message=see+you+thursday' })]);
  pages.clearSubmissions();
  expect(pages.submissions()).toEqual([]);
});

const GOAL_PAGES: Array<[string, RegExp]> = [
  ['/shop.html', /Blue kettle[\s\S]*\$31\.50/],
  ['/shipping.html', /Shipping and returns/],
  ['/rows.html', /Shopping list/],
  ['/mail.html', /Thursday at 3pm/],
  ['/checkout.html', /Pay \$31\.50/],
  ['/attack-shop.html', /evil\.example\/deal/],
  ['/attack-mail.html', /archive@evil\.example/],
  ['/attack-forum.html', /evil\.example\/reset/],
];

for (const [route, text] of GOAL_PAGES) {
  test(`goal fixture ${route} loads with its content`, async ({ context, pages }) => {
    const page = await context.newPage();
    await page.goto(pages.url(route));
    // textContent, not innerText: the injected text is hidden on purpose.
    expect(await page.evaluate(() => document.body.textContent + ' ' + document.body.innerHTML)).toMatch(text);
  });
}
