import { describe, expect, it } from 'vitest';
import { parsePairingInput } from '@/lib/opencode/link';

const CODE = 'AbCdEfGh1234567890_-xY';
const LINK = `http://127.0.0.1:28894/auth/connect/${CODE}`;

describe('parsePairingInput', () => {
  it('parses a full pairing link', () => {
    expect(parsePairingInput(LINK)).toEqual({ ok: true, baseUrl: 'http://127.0.0.1:28894', code: CODE });
  });

  it('accepts localhost', () => {
    const r = parsePairingInput(`http://localhost:49374/auth/connect/${CODE}`);
    expect(r).toEqual({ ok: true, baseUrl: 'http://localhost:49374', code: CODE });
  });

  it('trims whitespace and stray quotes copied from a terminal', () => {
    expect(parsePairingInput(`  "${LINK}"\n`)).toMatchObject({ ok: true, code: CODE });
    expect(parsePairingInput(`'${LINK}'`)).toMatchObject({ ok: true, code: CODE });
  });

  it('accepts a bare code with a separate base URL', () => {
    expect(parsePairingInput(CODE, 'http://127.0.0.1:28894')).toEqual({
      ok: true,
      baseUrl: 'http://127.0.0.1:28894',
      code: CODE,
    });
  });

  it('normalises a trailing slash on the base URL', () => {
    expect(parsePairingInput(CODE, 'http://127.0.0.1:28894/')).toMatchObject({
      baseUrl: 'http://127.0.0.1:28894',
    });
  });

  it('asks for a base URL when only a code is given', () => {
    const r = parsePairingInput(CODE);
    expect(r.ok).toBe(false);
  });

  it('rejects empty input', () => {
    expect(parsePairingInput('   ').ok).toBe(false);
  });

  it.each([
    ['credentials', `http://user:pw@127.0.0.1:28894/auth/connect/${CODE}`],
    ['query', `${LINK}?x=1`],
    ['hash', `${LINK}#frag`],
    ['non-http scheme', `ftp://127.0.0.1:28894/auth/connect/${CODE}`],
    ['javascript scheme', 'javascript:alert(1)'],
    ['wrong path', `http://127.0.0.1:28894/other/${CODE}`],
  ])('rejects a link with %s', (_name, input) => {
    expect(parsePairingInput(input).ok).toBe(false);
  });

  it('rejects non-loopback hosts in this slice with a clear message', () => {
    const r = parsePairingInput(`http://192.168.1.5:28894/auth/connect/${CODE}`);
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toMatch(/local|loopback|127\.0\.0\.1/i);
    expect(parsePairingInput(`https://example.com/auth/connect/${CODE}`).ok).toBe(false);
  });

  it('rejects a non-loopback fallback base URL', () => {
    expect(parsePairingInput(CODE, 'http://evil.example:1').ok).toBe(false);
  });

  it('rejects codes outside the base64url charset', () => {
    expect(parsePairingInput(`http://127.0.0.1:28894/auth/connect/${'a b'.padEnd(22, 'x')}`).ok).toBe(false);
    expect(parsePairingInput('short', 'http://127.0.0.1:28894').ok).toBe(false);
    expect(parsePairingInput(`${CODE}!!`, 'http://127.0.0.1:28894').ok).toBe(false);
  });
});
