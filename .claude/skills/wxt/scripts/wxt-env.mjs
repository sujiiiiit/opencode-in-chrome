#!/usr/bin/env node
// Orient in a WXT project in one shot: versions, config, entrypoints, and known pitfalls.
//   node wxt-env.mjs [projectRoot] [--online]
// --online also compares installed versions with the latest on npm.
// Read-only: never installs, builds, or edits anything.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const online = args.includes('--online');
const root = resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
const warnings = [];
const out = (s = '') => console.log(s);
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return undefined;
  }
};
const readText = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const pkg = readJson(join(root, 'package.json'));
if (!pkg) {
  console.error(`No package.json in ${root}. Pass the project root as the first argument.`);
  process.exit(1);
}
const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
const installed = (name) => readJson(join(root, 'node_modules', name, 'package.json'))?.version;
const configFile = ['wxt.config.ts', 'wxt.config.mts', 'wxt.config.js', 'wxt.config.mjs'].find((f) => existsSync(join(root, f)));
const config = configFile ? readText(join(root, configFile)) : '';

// ---- Versions ------------------------------------------------------------
const pm = existsSync(join(root, 'pnpm-lock.yaml')) ? 'pnpm'
  : existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb')) ? 'bun'
  : existsSync(join(root, 'yarn.lock')) ? 'yarn'
  : existsSync(join(root, 'package-lock.json')) ? 'npm' : 'unknown (no lockfile)';
const wxtVersion = installed('wxt');
const [, minor] = (wxtVersion ?? deps.wxt ?? '0.0.0').replace(/^[^\d]*/, '').split('.').map(Number);

out(`# WXT project: ${pkg.name ?? '(unnamed)'}  @ ${root}`);
out(`package manager: ${pm}   node: ${process.versions.node}`);
out(`wxt: declared ${deps.wxt ?? 'MISSING'}, installed ${wxtVersion ?? 'not installed (run install)'}`);
if (!deps.wxt) warnings.push('`wxt` is not in package.json. Is this the right folder?');
if (Number(process.versions.node.split('.')[0]) < 22 && minor >= 21) warnings.push('WXT 0.21+ requires Node >= 22.');

const interesting = Object.keys(deps).filter((d) => /^(wxt|@wxt-dev\/|@webext-core\/|webext-|trpc-chrome|comctx|react|react-dom|vue|svelte|solid-js|vite|web-ext|typescript|tailwindcss|@tailwindcss\/|unocss|postcss|vitest|@playwright\/|playwright|webextension-polyfill|@types\/chrome|zustand|jotai|@tanstack\/|react-router|antd|@mantine\/|@radix-ui\/)/.test(d));
out('\n## Relevant dependencies (declared -> installed)');
for (const d of interesting.sort()) out(`- ${d}: ${deps[d]} -> ${installed(d) ?? 'not installed'}`);

if (minor >= 21) {
  if (!deps.vite) warnings.push('WXT 0.21+ lists `vite` as a REQUIRED peer dependency: add it to devDependencies (`<pm> add -D vite`). Some package managers auto-install peers, which hides this until CI or a fresh clone.');
  if (!deps['web-ext']) warnings.push('`web-ext` is not installed, so `wxt` dev mode will NOT open a browser automatically (an optional peer since 0.21). Install it with `<pm> add -D web-ext` if you want auto-open.');
  if (!deps.typescript) warnings.push('`typescript` (>= 5.4) is an optional peer in 0.21+. Add it if the project type-checks.');
}
if (!/wxt prepare/.test(pkg.scripts?.postinstall ?? '')) warnings.push('package.json is missing `"postinstall": "wxt prepare"`, so types and auto-imports can go stale after installs.');

// ---- Config --------------------------------------------------------------
out(`\n## Config: ${configFile ?? 'NONE (defaults apply)'}`);
const grab = (re) => config.match(re)?.[1];
const srcDir = grab(/srcDir\s*:\s*['"`]([^'"`]+)['"`]/) ?? '.';
const entrypointsDir = grab(/entrypointsDir\s*:\s*['"`]([^'"`]+)['"`]/) ?? 'entrypoints';
const modules = [...(grab(/modules\s*:\s*\[([^\]]*)\]/s) ?? '').matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
out(`srcDir: ${srcDir}   entrypointsDir: ${entrypointsDir}`);
out(`modules: ${modules.length ? modules.join(', ') : '(none)'}`);
for (const key of ['manifestVersion', 'targetBrowsers', 'browser', 'outDir', 'publicDir', 'imports', 'alias', 'hooks', 'webExt', 'zip', 'filterEntrypoints', 'experimental', 'dev', 'vite', 'manifest']) {
  if (new RegExp(`\\b${key}\\s*:`).test(config)) out(`- sets \`${key}\``);
}
if (/manifest\s*:\s*\(/.test(config) || /manifest\s*:\s*\(\s*\{/.test(config)) out('- manifest is a function (per-browser / env-aware)');
if (/tailwindcss\(\)/.test(config)) out('- Tailwind v4 Vite plugin is registered');
for (const f of ['web-ext.config.ts', 'app.config.ts', join(srcDir, 'app.config.ts'), '.env', '.env.local', '.env.submit', '.env.publish', 'vitest.config.ts', 'playwright.config.ts', 'postcss.config.mjs', 'postcss.config.js', 'tailwind.config.ts', 'tailwind.config.js', 'uno.config.ts']) {
  if (existsSync(join(root, f))) out(`- found ${f.replaceAll('\\', '/')}`);
}

// ---- Entrypoints (mirrors WXT's flat entrypoint finder, first match wins) --
const CSS = '(css|scss|sass|less|styl|stylus)';
const RULES = [
  [/^(sandbox|[^/]+\.sandbox)(\.html|\/index\.html)$/, 'sandbox'],
  [/^bookmarks(\.html|\/index\.html)$/, 'bookmarks'],
  [/^history(\.html|\/index\.html)$/, 'history'],
  [/^newtab(\.html|\/index\.html)$/, 'newtab'],
  [/^(sidepanel|[^/]+\.sidepanel)(\.html|\/index\.html)$/, 'sidepanel'],
  [/^devtools(\.html|\/index\.html)$/, 'devtools'],
  [/^background(\.[jt]s|\/index\.[jt]s)$/, 'background'],
  [/^(content|[^/]+\.content)(\.[jt]sx?|\/index\.[jt]sx?)$/, 'content-script'],
  [new RegExp(`^(content|[^/]+\\.content)(\\.${CSS}|/index\\.${CSS})$`), 'content-script-style'],
  [/^popup(\.html|\/index\.html)$/, 'popup'],
  [/^options(\.html|\/index\.html)$/, 'options'],
  [/^[^/]+\.html$|^[^/]+\/index\.html$/, 'unlisted-page'],
  [/^[^/]+\.[jt]sx?$|^[^/]+\/index\.[jt]sx?$/, 'unlisted-script'],
  [new RegExp(`^[^/]+\\.${CSS}$|^[^/]+/index\\.${CSS}$`), 'unlisted-style'],
];
const epDir = join(root, srcDir, entrypointsDir);
out(`\n## Entrypoints in ${join(srcDir, entrypointsDir).replaceAll('\\', '/')}/`);
const found = [];
if (existsSync(epDir)) {
  for (const name of readdirSync(epDir)) {
    const full = join(epDir, name);
    const candidates = statSync(full).isDirectory()
      ? readdirSync(full).filter((f) => f.startsWith('index.')).map((f) => `${name}/${f}`)
      : [name];
    let matched = false;
    for (const rel of candidates) {
      const rule = RULES.find(([re]) => re.test(rel));
      if (rule) {
        found.push([rel, rule[1]]);
        matched = true;
      }
    }
    if (!matched && statSync(full).isDirectory()) {
      const nested = readdirSync(full).filter((f) => statSync(join(full, f)).isDirectory());
      warnings.push(`entrypoints/${name}/ has no index.* file, so WXT ignores it${nested.length ? ` (nested dirs: ${nested.join(', ')}; entrypoints can only be ONE level deep)` : ''}.`);
    }
  }
  for (const [rel, type] of found) out(`- ${type.padEnd(22)} ${rel}`);
  const unlistedScripts = found.filter(([rel, t]) => t === 'unlisted-script' && /^[A-Z]|^(App|main|utils?|helpers?|types?|constants?)\./.test(rel));
  for (const [rel] of unlistedScripts) warnings.push(`entrypoints/${rel} will be built as an UNLISTED SCRIPT. If it is a helper/component for another entrypoint, move it into that entrypoint's folder (e.g. entrypoints/popup/${rel}).`);
  if (!found.some(([, t]) => t === 'background')) out('(no background: WXT adds a no-op one in dev mode for reloading)');
} else {
  warnings.push(`Entrypoints dir not found: ${epDir}`);
}

// ---- TypeScript / generated dir --------------------------------------------
const tsconfig = readText(join(root, 'tsconfig.json'));
if (tsconfig && !/\.wxt\/tsconfig\.json/.test(tsconfig)) warnings.push('tsconfig.json does not extend ".wxt/tsconfig.json", so auto-import types and path aliases will be missing.');
if (!existsSync(join(root, '.wxt'))) warnings.push('.wxt/ is missing. Run `wxt prepare` to generate types (auto-imports, browser.runtime.getURL paths).');
if (/"paths"\s*:/.test(tsconfig)) warnings.push('tsconfig.json defines "paths". WXT wants aliases in wxt.config.ts `alias` instead (it writes them to .wxt/tsconfig.json AND the bundler).');

// ---- Stale / removed API usage ------------------------------------------------
const STALE = [
  [/from ['"]wxt\/(storage|sandbox|client)['"]/, "imports from wxt/storage|wxt/sandbox|wxt/client (removed in 0.20): use '#imports'"],
  [/from ['"]wxt\/testing['"]/, "imports the wxt/testing barrel (removed in 0.21): use 'wxt/testing/fake-browser' and 'wxt/testing/vitest-plugin'"],
  [/\buseAppConfig\(/, 'useAppConfig() is deprecated: use getAppConfig()'],
  [/defineRunnerConfig|ExtensionRunnerConfig/, 'defineRunnerConfig/ExtensionRunnerConfig removed in 0.21: use defineWebExtConfig/WebExtConfig'],
  [/\brunner\s*:\s*\{/, '`runner:` config removed in 0.21: use `webExt:`'],
  [/transformManifest/, 'transformManifest removed in 0.20: use the build:manifestGenerated hook'],
  [/extensionApi\s*:/, 'extensionApi config removed in 0.20'],
  [/['"]url:https?:/, 'url: remote imports removed in 0.21: vendor the file or use an npm package'],
  [/createContentScriptUi|createContentScriptIframe/, 'createContentScriptUi/Iframe renamed (0.14): createShadowRootUi / createIframeUi'],
  [/hostname\s*:/, 'dev.server.hostname removed in 0.21: use dev.server.host (ignore if unrelated)'],
  [/ctx\.isInvalidated\b/, 'ctx.isInvalidated does not exist: use ctx.isInvalid / ctx.isValid / ctx.onInvalidated()'],
  [/(?<!await\s+)(?<![\w.])createShadowRootUi\(\s*ctx/, 'createShadowRootUi is async: `await` it before calling mount()/autoMount() (ignore if the promise is awaited later)'],
  [/onMessage\.addListener\(\s*async\b/, 'async runtime.onMessage listener: it returns a Promise, so `return true` / promise replies do not work on Chromium. Use a non-async listener with sendResponse + return true (ignore for @webext-core/messaging onMessage)'],
  [/defineContentScript\(\{[^}]*\bcss\s*:\s*\[/s, '`css:` is not a defineContentScript option: import the CSS file in the entry and set cssInjectionMode'],
  [/querySelector\(['"](body|head)['"]\)/, "shadow.querySelector('body'|'head') returns null on WXT 0.21+ (the shadow root is now <style> + <div>, with no html/head/body): use the onMount `container` or `shadow` instead (ignore if this is not shadow-root code)"],
];
// Security smells: heuristics, so each message says what to check. Third item = skip if the file matches it.
const SECURITY = [
  [/\.(innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML\(|document\.write\(|dangerouslySetInnerHTML/, 'SECURITY: HTML injection sink. Use textContent/React text, or sanitize (DOMPurify) if the string can contain page or remote data'],
  [/\beval\(|new Function\(|set(Timeout|Interval)\(\s*['"`]/, 'SECURITY: eval-like code. Forbidden by the MV3 CSP and store policy (remote/dynamic code)'],
  [/postMessage\([^;]*,\s*['"]\*['"]\s*\)/, "SECURITY: postMessage with targetOrigin '*'. Any frame/page can read it; use a specific origin and never send secrets"],
  [/addEventListener\(\s*['"]message['"]/, "SECURITY: window 'message' listener without an origin/source check. Check event.source === window and event.origin", /\.origin\b|\.source\b/],
  [/onMessageExternal\.addListener|onConnectExternal\.addListener/, 'SECURITY: external messages without a sender check. Allowlist sender.origin / sender.id', /sender\??\.(origin|id|url)\b/],
  [/fetch\(\s*(msg|message|data|request|req|payload|params)\b|tabs\.(create|update)\(\s*(\w+\s*,\s*)?\{\s*url:\s*(msg|message|data|request|payload)\b|downloads\.download\(\s*\{\s*url:\s*(msg|message|data|request|payload)\b/, 'SECURITY: URL taken straight from a message. Allowlist protocol/host (new URL()) or expose a named action instead (no generic proxies)'],
  [/executeScript\([\s\S]{0,200}?(files|func|args)\s*:\s*(msg|message|data|request|payload)\b/, 'SECURITY: executeScript driven by message data. Only inject fixed, bundled scripts'],
  [/TRUSTED_AND_UNTRUSTED_CONTEXTS/, 'SECURITY: storage.session opened to content scripts. Make sure no tokens/secrets live in session storage'],
  [/['"]sync:[^'"]*(token|secret|password|passwd|auth|session|cookie|apikey|api-key)/i, 'SECURITY: secret-looking key in sync: storage (copied to every signed-in device). Use session:/local: in the background'],
  [/import\.meta\.env\.(WXT|VITE)_\w*(SECRET|PRIVATE|PASSWORD|PASSWD)/, 'SECURITY: secret-named env var used in extension code. It ships in the bundle; proxy through a server'],
];
const scanDirs = [join(root, srcDir), root].filter((d, i, a) => a.indexOf(d) === i);
const seen = new Set();
const scan = (dir, depth = 0) => {
  if (depth > 6 || !existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (/^(node_modules|\.output|\.wxt|\.git|dist|coverage|\.claude)$/.test(name)) continue;
    const full = join(dir, name);
    if (seen.has(full)) continue;
    seen.add(full);
    if (statSync(full).isDirectory()) scan(full, depth + 1);
    else if (/\.(m?[jt]sx?|vue|svelte)$/.test(name)) {
      const text = readFileSync(full, 'utf8');
      const rel = full.slice(root.length + 1).replaceAll('\\', '/');
      for (const [re, msg] of STALE) if (re.test(text)) warnings.push(`${rel}: ${msg}`);
      for (const [re, msg, okIf] of SECURITY) if (re.test(text) && !okIf?.test(text)) warnings.push(`${rel}: ${msg}`);
    }
  }
};
scanDirs.forEach((d) => scan(d));

// ---- Secrets in env files and git ---------------------------------------------
const gitignore = readText(join(root, '.gitignore')) ?? '';
for (const name of readdirSync(root).filter((n) => /^\.env/.test(n))) {
  const env = readText(join(root, name)) ?? '';
  const risky = env.split(/\r?\n/).filter((l) => /^(WXT|VITE)_\w*(SECRET|PRIVATE|PASSWORD|PASSWD|TOKEN)\w*\s*=/i.test(l)).map((l) => l.split('=')[0].trim());
  if (risky.length) warnings.push(`SECURITY: ${name} defines ${risky.join(', ')}. WXT_/VITE_ values are public once bundled; keep real secrets server-side`);
}
if (existsSync(join(root, '.env.submit')) && !/\.env\.submit|\.env\*|\.env\.\*/.test(gitignore)) warnings.push('SECURITY: .env.submit (store credentials) is not in .gitignore');
if (/<all_urls>|\*:\/\/\*\/\*/.test(config)) warnings.push('SECURITY/REVIEW: wxt.config requests all sites. Prefer activeTab or optional_host_permissions unless the feature truly needs every site');
if (/unsafe-eval/.test(config)) warnings.push("SECURITY: 'unsafe-eval' in CSP. Not allowed for MV3 extension pages; use a sandbox page");

// ---- Existing build output ------------------------------------------------------
const outDir = join(root, grab(/outDir\s*:\s*['"`]([^'"`]+)['"`]/) ?? '.output');
if (existsSync(outDir)) {
  const targets = readdirSync(outDir).filter((d) => existsSync(join(outDir, d, 'manifest.json')));
  if (targets.length) out(`\n## Built targets in ${outDir.slice(root.length + 1)}/: ${targets.join(', ')}  (inspect: node scripts/inspect-manifest.mjs)`);
}

// ---- Online comparison -----------------------------------------------------------
if (online) {
  out('\n## Latest on npm');
  const names = ['wxt', ...interesting.filter((d) => d !== 'wxt' && (d.startsWith('@wxt-dev/') || d.startsWith('@webext-core/')))];
  for (const n of names) {
    try {
      const res = await fetch(`https://registry.npmjs.org/${n.replace('/', '%2F')}/latest`);
      const latest = (await res.json()).version;
      const inst = installed(n);
      out(`- ${n}: installed ${inst ?? '-'}, latest ${latest}${inst && inst !== latest ? '  <- update available' : ''}`);
    } catch {
      out(`- ${n}: lookup failed`);
    }
  }
}

out('\n## Warnings');
if (!warnings.length) out('none');
const pmCmd = pm.startsWith('unknown') ? 'npm' : pm;
for (const w of [...new Set(warnings)]) out(`- ${w.replaceAll('<pm>', pmCmd)}`);
