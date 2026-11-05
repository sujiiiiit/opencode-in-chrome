import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CdpEvent } from '@/lib/browser/debugger';
import { ConsoleLog, formatSize, NetworkLog, siteOf } from '@/lib/browser/diagnostics';
import { formatEvalResult } from '@/lib/browser/tools/diagnostics';
import { codeOf } from '../../support/fake-chrome';

/** A DebuggerSessions stand-in that only routes events. */
function bus() {
  const listeners: Array<(e: CdpEvent) => void> = [];
  return {
    subscribe: (l: (e: CdpEvent) => void) => void listeners.push(l),
    onDetach: () => undefined,
    send: vi.fn(),
    emit: (method: string, params: Record<string, unknown>, tabId = 1, sessionId?: string) => listeners.forEach((l) => l({ tabId, sessionId, method, params })),
  };
}

describe('ConsoleLog', () => {
  let b: ReturnType<typeof bus>;
  let log: ConsoleLog;
  beforeEach(() => {
    b = bus();
    log = new ConsoleLog(b as never, () => new Date('2026-11-05T20:31:24').getTime());
  });

  it('records console calls and filters by pattern', () => {
    b.emit('Runtime.consoleAPICalled', { type: 'log', args: [{ type: 'string', value: 'probe-log' }, { type: 'number', value: 1 }] });
    b.emit('Runtime.consoleAPICalled', { type: 'warning', args: [{ type: 'string', value: 'other' }] });
    expect(log.read(1, { pattern: 'probe' })).toBe('[1] 20:31:24 LOG probe-log 1');
    expect(log.read(1, {})).toContain('[2] 20:31:24 WARN other');
  });

  it('records uncaught exceptions with their first stack frame', () => {
    b.emit('Runtime.exceptionThrown', {
      exceptionDetails: {
        text: 'Uncaught',
        exception: { description: 'Error: boom\n    at x' },
        stackTrace: { callFrames: [{ functionName: 'explode', url: 'http://a.test/app.js', lineNumber: 9, columnNumber: 4 }] },
      },
    });
    expect(log.read(1, { onlyErrors: true })).toBe('[1] 20:31:24 ERROR Error: boom\n    at explode (http://a.test/app.js:10:5)');
  });

  it('keeps messages across same-site navigations and clears them on a new site', () => {
    b.emit('Page.frameNavigated', { frame: { url: 'https://www.shop.test/a' } });
    b.emit('Runtime.consoleAPICalled', { type: 'log', args: [{ type: 'string', value: 'first' }] });
    b.emit('Page.frameNavigated', { frame: { url: 'https://shop.test/b' } });
    expect(log.read(1, {})).toContain('first');
    b.emit('Page.frameNavigated', { frame: { url: 'https://other.test/' } });
    expect(log.read(1, {})).toBe('No console messages from this site yet.');
  });

  it('clears what it returned and rejects a bad pattern', async () => {
    b.emit('Runtime.consoleAPICalled', { type: 'log', args: [{ type: 'string', value: 'once' }] });
    log.read(1, { clear: true });
    expect(log.read(1, {})).toMatch(/^No console messages/);
    expect(await codeOf(Promise.resolve().then(() => log.read(1, { pattern: '(' })))).toBe('INVALID_INPUT');
  });
});

describe('NetworkLog', () => {
  let b: ReturnType<typeof bus>;
  let net: NetworkLog;
  beforeEach(() => {
    b = bus();
    net = new NetworkLog(b as never);
  });

  const request = (id: string, url: string, type = 'Fetch', status = 200, size = 1234) => {
    b.emit('Network.requestWillBeSent', { requestId: id, request: { url, method: 'GET' }, type, timestamp: 10 });
    b.emit('Network.responseReceived', { requestId: id, response: { status, mimeType: 'application/json' }, type });
    b.emit('Network.loadingFinished', { requestId: id, encodedDataLength: size, timestamp: 10.084 });
  };

  it('lists requests with status, type, size and duration, skipping data and extension URLs', () => {
    request('1', 'https://app.test/api/items');
    request('2', 'data:image/png;base64,AAA');
    request('3', 'chrome-extension://abc/snapshot.js');
    request('4', 'https://app.test/style.css', 'Stylesheet', 200, 300);
    expect(net.read(1, {})).toBe(
      'r1 GET 200 fetch 1.2 kB 84 ms https://app.test/api/items\nr2 GET 200 stylesheet 300 B 84 ms https://app.test/style.css\nUse request_id (e.g. r2) to read a text response body.',
    );
    expect(net.read(1, { urlPattern: '/api/' })).toMatch(/^r1 GET 200 fetch/);
  });

  it('marks failures and reads text bodies by id', async () => {
    b.emit('Network.requestWillBeSent', { requestId: '9', request: { url: 'https://down.test/', method: 'POST' }, type: 'XHR', timestamp: 1 });
    b.emit('Network.loadingFailed', { requestId: '9', errorText: 'net::ERR_CONNECTION_REFUSED', timestamp: 1.5 });
    expect(net.read(1, {})).toContain('r1 POST ERR(net::ERR_CONNECTION_REFUSED) xhr - 500 ms https://down.test/');
    request('10', 'https://app.test/api/items');
    b.send.mockResolvedValueOnce({ body: '{"items":[1,2,3]}', base64Encoded: false });
    expect(await net.body(1, 'r2')).toBe('GET 200 https://app.test/api/items\n---\n{"items":[1,2,3]}');
    expect(await codeOf(net.body(1, 'r77'))).toBe('STALE_REF');
  });
});

describe('helpers', () => {
  it('formats eval results and sizes', () => {
    expect(formatEvalResult({ result: { type: 'string', value: 'Pizza order' } })).toBe('"Pizza order"');
    expect(formatEvalResult({ result: { type: 'undefined' } })).toBe('undefined');
    expect(formatEvalResult({ result: { type: 'number', unserializableValue: 'NaN' } })).toBe('NaN');
    expect(formatEvalResult({ result: { type: 'string', value: 'x'.repeat(30) } }, 10)).toMatch(/\[truncated at 10 of 32 chars\]$/);
    expect(formatSize(2_500_000)).toBe('2.4 MB');
    expect(siteOf('https://www.example.com/x')).toBe('example.com');
  });
});
