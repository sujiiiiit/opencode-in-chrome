// Serves the fixture pages in e2e/pages. The same server answers on 127.0.0.1 and on
// localhost, which are different sites, so a page can embed a real cross-origin iframe.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../pages');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };

/** A request body a fixture page sent to `/submit` (or `/submit/<anything>`). */
export type Submission = { path: string; contentType: string; body: string; at: number };

export type PageServer = {
  origin: string;
  otherOrigin: string;
  url(p: string): string;
  otherUrl(p: string): string;
  /** Bodies received at /submit since the server started (or since `clearSubmissions`), oldest first. */
  submissions(): Submission[];
  clearSubmissions(): void;
  close(): Promise<void>;
};

export async function startPageServer(): Promise<PageServer> {
  const received: Submission[] = [];
  const server = createServer((req, res) => {
    if (isSubmit(req)) void recordSubmission(req, res, received);
    else void servePage(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;
  const otherOrigin = `http://localhost:${port}`;
  return {
    origin,
    otherOrigin,
    url: (p) => origin + p,
    otherUrl: (p) => otherOrigin + p,
    submissions: () => [...received],
    clearSubmissions: () => {
      received.length = 0;
    },
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

function isSubmit(req: IncomingMessage): boolean {
  const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1');
  return req.method === 'POST' && (pathname === '/submit' || pathname.startsWith('/submit/'));
}

/** Records the body, then answers with a small page so a form post lands somewhere readable. */
async function recordSubmission(req: IncomingMessage, res: ServerResponse, received: Submission[]): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1');
  received.push({ path: pathname, contentType: String(req.headers['content-type'] ?? ''), body: Buffer.concat(chunks).toString('utf8'), at: Date.now() });
  if (/json/.test(String(req.headers.accept ?? '')) || /json/.test(String(req.headers['content-type'] ?? ''))) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><title>Received</title><h1>Received</h1><p id="status">Your submission was received.</p>');
}

async function servePage(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/api/items') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ items: [1, 2, 3] }));
    return;
  }
  if (url.pathname === '/export.csv') {
    res.writeHead(200, { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="export.csv"' });
    res.end('item,price\nRed kettle,24.00\n');
    return;
  }
  if (url.pathname === '/slow') {
    const ms = Number(url.searchParams.get('ms') ?? 20_000);
    await new Promise((r) => setTimeout(r, ms));
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<title>Slow</title><h1>Finally</h1>');
    return;
  }
  await serveFile(url.pathname, res);
}

async function serveFile(pathname: string, res: ServerResponse): Promise<void> {
  // A single-page app: every /spa route serves the same document.
  const route = pathname.startsWith('/spa') ? '/spa.html' : pathname === '/' ? '/index.html' : pathname;
  const file = path.join(ROOT, path.normalize(route));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = await readFile(file);
    const headers: Record<string, string> = { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' };
    if (path.basename(file) === 'csp.html') headers['content-security-policy'] = "script-src 'self'; object-src 'none'";
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}
