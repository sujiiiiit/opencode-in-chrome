#!/usr/bin/env node
// WXT docs helper: live research + offline vendored docs. Zero dependencies (Node >= 18).
//
//   node wxt-docs.mjs search <regex> [--live]   grep the vendored docs (or the live llms-full.txt)
//   node wxt-docs.mjs page <path|url>           print one docs page, live first, vendored fallback
//                                               e.g. guide/essentials/content-scripts  |  storage  |  api/reference/wxt/interfaces/InlineConfig
//   node wxt-docs.mjs index                     print the live docs table of contents (llms.txt)
//   node wxt-docs.mjs examples                  list official examples (github.com/wxt-dev/examples)
//   node wxt-docs.mjs example <name>            print every text file of one example
//   node wxt-docs.mjs versions [pkg...]         latest npm versions (defaults to the WXT ecosystem)
//   node wxt-docs.mjs refresh                   re-download and re-split the vendored docs snapshot

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(HERE, '../references/docs');
const SITE = 'https://wxt.dev';
const EXAMPLES_API = 'https://api.github.com/repos/wxt-dev/examples';
const EXAMPLES_RAW = 'https://raw.githubusercontent.com/wxt-dev/examples/main';
const ECOSYSTEM = [
  'wxt', '@wxt-dev/module-react', '@wxt-dev/storage', '@wxt-dev/i18n', '@wxt-dev/auto-icons',
  '@wxt-dev/analytics', '@wxt-dev/unocss', '@wxt-dev/browser', '@wxt-dev/webextension-polyfill',
  '@wxt-dev/is-background', '@wxt-dev/runner', '@webext-core/messaging', '@webext-core/proxy-service',
  'webext-bridge', 'trpc-chrome', 'comctx', 'publish-browser-extension', 'web-ext', 'vite',
  'tailwindcss', '@tailwindcss/vite',
];

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'wxt-skill-docs' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

// llms-full.txt is a concatenation of pages, each starting with a front-matter block:
//   ---\nurl: /guide/x.md\n---   (long urls are folded as `url: >-` + an indented next line)
function splitPages(full) {
  const lines = full.split('\n');
  const pages = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '---' && lines[i + 1]?.startsWith('url: ')) {
      let url = lines[i + 1].slice(5).trim();
      let skip = 2;
      if (url === '>-') {
        url = lines[i + 2].trim();
        skip = 3;
      }
      if (lines[i + skip] === '---') skip++;
      if (current) pages.push(current);
      current = { url, body: [] };
      i += skip - 1;
      continue;
    }
    current?.body.push(lines[i]);
  }
  if (current) pages.push(current);
  for (const page of pages) {
    while (page.body.length && /^(---)?\s*$/.test(page.body.at(-1))) page.body.pop();
    page.text = page.body.join('\n').trim() + '\n';
    page.title = page.body.find((l) => l.startsWith('# '))?.slice(2).trim() ?? page.url;
  }
  return pages;
}

function sectionOf(url) {
  if (url.startsWith('/guide/essentials/config/')) return 'Guide: Configuration';
  if (url.startsWith('/guide/essentials/')) return 'Guide: Essentials';
  if (url.startsWith('/guide/resources/')) return 'Guide: Resources';
  if (url.startsWith('/guide/')) return 'Guide: Get Started';
  if (url.startsWith('/api/cli/')) return 'CLI';
  if (url.startsWith('/api/reference/')) return 'API Reference (generated from types)';
  return 'Companion Packages';
}

async function refresh() {
  const [full, latest] = await Promise.all([
    get(`${SITE}/llms-full.txt`),
    get('https://registry.npmjs.org/wxt/latest').then((t) => JSON.parse(t).version).catch(() => 'unknown'),
  ]);
  const pages = splitPages(full).filter((p) => p.text.trim().length > 0);
  await rm(DOCS_DIR, { recursive: true, force: true });
  for (const page of pages) {
    const file = join(DOCS_DIR, page.url.replace(/^\//, ''));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `<!-- source: ${SITE}${page.url} -->\n${page.text}`);
  }
  const groups = new Map();
  for (const page of pages) {
    const s = sectionOf(page.url);
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s).push(page);
  }
  const order = ['Guide: Get Started', 'Guide: Essentials', 'Guide: Configuration', 'Guide: Resources',
    'Companion Packages', 'CLI', 'API Reference (generated from types)'];
  let index = `# Vendored WXT docs snapshot\n\nFetched ${new Date().toISOString().slice(0, 10)} from ${SITE}/llms-full.txt (latest wxt on npm: ${latest}).\n`
    + `Paths below are relative to this folder. Refresh with \`node scripts/wxt-docs.mjs refresh\`.\n`
    + `The API reference pages are generated from WXT's TypeScript types, so they list every option with its exact type and default.\n`;
  for (const s of order) {
    const list = groups.get(s);
    if (!list) continue;
    index += `\n## ${s}\n\n`;
    for (const p of list) index += `- [${p.title}](${p.url.replace(/^\//, '')})\n`;
  }
  await writeFile(join(DOCS_DIR, 'INDEX.md'), index);
  console.log(`Wrote ${pages.length} pages to ${DOCS_DIR} (wxt latest: ${latest})`);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith('.md')) yield p;
  }
}

async function search(pattern, live, limit) {
  const re = new RegExp(pattern, 'i');
  let hits = 0;
  const report = (where, n, line) => {
    if (hits++ < limit) console.log(`${where}:${n}: ${line.trim().slice(0, 160)}`);
  };
  if (live) {
    for (const page of splitPages(await get(`${SITE}/llms-full.txt`))) {
      page.body.forEach((line, i) => re.test(line) && report(page.url, i + 1, line));
    }
  } else {
    // Guide and package pages first: they explain usage; the generated API pages repeat each option many times.
    const files = [];
    for await (const file of walk(DOCS_DIR)) files.push(file);
    const isApi = (f) => relative(DOCS_DIR, f).replaceAll('\\', '/').startsWith('api/');
    files.sort((a, b) => Number(isApi(a)) - Number(isApi(b)) || a.localeCompare(b));
    for (const file of files) {
      const lines = (await readFile(file, 'utf8')).split('\n');
      lines.forEach((line, i) => re.test(line) && report(relative(DOCS_DIR, file).replaceAll('\\', '/'), i + 1, line));
    }
  }
  if (hits > limit) console.log(`... ${hits - limit} more matches (narrow the pattern, or --limit N)`);
  if (!hits) console.log('No matches. Try a broader pattern, --live, or `index` to browse.');
}

async function page(arg) {
  const path = arg.replace(/^https?:\/\/wxt\.dev/, '').replace(/^\//, '').replace(/\.html$/, '').replace(/\.md$/, '');
  try {
    process.stdout.write(await get(`${SITE}/${path}.md`));
  } catch (err) {
    try {
      const file = resolve(DOCS_DIR, `${path}.md`);
      if (!file.startsWith(DOCS_DIR)) throw new Error('outside docs');
      process.stdout.write(await readFile(file, 'utf8'));
      console.error(`\n[live fetch failed (${err.message}); printed vendored copy]`);
    } catch {
      console.error(`Not found live or vendored: ${path}. Run \`index\` or \`search\` to find the right path.`);
      process.exitCode = 1;
    }
  }
}

async function examples() {
  const list = JSON.parse(await get(`${EXAMPLES_API}/contents/examples`));
  console.log(list.filter((e) => e.type === 'dir').map((e) => e.name).join('\n'));
  console.log('\nPrint one with: node wxt-docs.mjs example <name>');
}

async function example(name) {
  const tree = JSON.parse(await get(`${EXAMPLES_API}/git/trees/main?recursive=1`)).tree;
  const files = tree.filter((t) => t.type === 'blob' && t.path.startsWith(`examples/${name}/`)
    && !/\.(png|jpe?g|gif|ico|svg|webp|woff2?|ttf|lock)$|pnpm-lock|package-lock/.test(t.path));
  if (!files.length) {
    console.error(`No example named "${name}". Run \`examples\` to list them.`);
    process.exitCode = 1;
    return;
  }
  for (const f of files) {
    console.log(`\n===== ${f.path}`);
    console.log(await get(`${EXAMPLES_RAW}/${f.path}`));
  }
}

async function versions(pkgs) {
  const names = pkgs.length ? pkgs : ECOSYSTEM;
  const rows = await Promise.all(names.map(async (n) => {
    try {
      return [n, JSON.parse(await get(`https://registry.npmjs.org/${n.replace('/', '%2F')}/latest`)).version];
    } catch {
      return [n, 'not found'];
    }
  }));
  for (const [n, v] of rows) console.log(`${n.padEnd(34)} ${v}`);
}

process.stdout.on('error', (err) => err.code === 'EPIPE' && process.exit(0));

const [cmd, ...rest] = process.argv.slice(2);
const live = rest.includes('--live');
const li = rest.indexOf('--limit');
const limit = li === -1 ? 40 : Number(rest[li + 1]) || 40;
const args = rest.filter((a, i) => a !== '--live' && a !== '--limit' && rest[i - 1] !== '--limit');
const commands = {
  refresh: () => refresh(),
  search: () => search(args.join(' '), live, limit),
  page: () => page(args[0] ?? ''),
  index: async () => process.stdout.write(await get(`${SITE}/llms.txt`)),
  examples: () => examples(),
  example: () => example(args[0] ?? ''),
  versions: () => versions(args),
};
if (!commands[cmd]) {
  console.log(readFileHelp());
  process.exitCode = cmd ? 1 : 0;
} else {
  commands[cmd]().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  });
}

function readFileHelp() {
  return `Usage: node wxt-docs.mjs <search|page|index|examples|example|versions|refresh> [args]
  search <regex> [--live] [--limit N]  grep vendored docs (default 40 hits)
  page <path>              one page, live first (e.g. guide/essentials/content-scripts, storage)
  index                    live table of contents
  examples | example <n>   official example projects
  versions [pkg...]        latest npm versions
  refresh                  re-download the vendored snapshot`;
}
