import { describe, expect, it } from 'vitest';
import { botCheckNote } from '@/lib/browser/bot-check';

describe('botCheckNote', () => {
  it('recognises Cloudflare and Google challenge pages', () => {
    expect(botCheckNote({ title: 'Just a moment...', url: 'https://example.com/x' })).toMatch(/bot check/);
    expect(botCheckNote({ title: 'https://www.google.com/search?q=a', url: 'https://www.google.com/sorry/index?continue=x' })).toMatch(/Do not try to solve/);
    expect(botCheckNote({ title: 'Anything', url: 'https://site.test/p?__cf_chl_rt_tk=abc' })).toMatch(/bot check/);
  });

  it('leaves ordinary pages alone, including ones that mention a captcha or a moment', () => {
    expect(botCheckNote({ title: 'Wait a moment: a history of clocks', url: 'https://site.test/clocks' })).toBeUndefined();
    expect(botCheckNote({ title: 'How CAPTCHA works', url: 'https://site.test/blog/captcha-explained' })).toBeUndefined();
    expect(botCheckNote({})).toBeUndefined();
  });
});
