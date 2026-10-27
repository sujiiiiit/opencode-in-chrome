#!/usr/bin/env node
// Show what WXT actually generated, per browser, and how the targets differ.
//   node inspect-manifest.mjs [projectRoot]                       summarize every .output/*/manifest.json
//   node inspect-manifest.mjs [projectRoot] --build chrome,firefox [--mv3|--mv2] [--mode production]
//                                                               run `wxt build -b <browser>` for each first
//   add --full to also print empty fields and the raw manifest JSON
//
// Use it to verify permissions, host permissions, CSP, content script registration, and
// per-browser keys (gecko id, sidebar_action vs side_panel) BEFORE shipping. The generated
// manifest is the source of truth, not what the config "should" produce.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const root = resolve(args.find((a, i) => !a.startsWith('--') && !['--build', '--mode'].includes(args[i - 1])) ?? process.cwd());
const full = args.includes('--full');
const mv = args.includes('--mv3') ? ' --mv3' : args.includes('--mv2') ? ' --mv2' : '';
const mode = flag('--mode');
const outDir = join(root, '.output');

const build = flag('--build');
// Values are interpolated into a shell command: accept plain names only.
for (const v of [build, mode]) {
  if (v && !/^[\w,.-]+$/.test(v)) {
    console.error(`Refusing unsafe argument: ${v}`);
    process.exit(1);
  }
}
if (build) {
  for (const browser of build.split(',').map((b) => b.trim()).filter(Boolean)) {
    const cmd = `npx wxt build -b ${browser}${mv}${mode ? ` --mode ${mode}` : ''}`;
    console.log(`$ ${cmd}`);
    try {
      execSync(cmd, { cwd: root, stdio: 'inherit' });
    } catch {
      console.error(`Build failed for ${browser}. Fix the error above before inspecting.`);
      process.exitCode = 1;
    }
  }
}

if (!existsSync(outDir)) {
  console.error(`No .output/ in ${root}. Build first (add --build chrome,firefox).`);
  process.exit(1);
}
const targets = readdirSync(outDir).filter((d) => existsSync(join(outDir, d, 'manifest.json')));
if (!targets.length) {
  console.error('No built targets with a manifest.json found.');
  process.exit(1);
}

const list = (v) => (Array.isArray(v) && v.length ? v.join(', ') : '-');
const summaries = {};
for (const t of targets) {
  const m = JSON.parse(readFileSync(join(outDir, t, 'manifest.json'), 'utf8'));
  const s = {
    manifest_version: m.manifest_version,
    name: m.name,
    version: `${m.version}${m.version_name ? ` (version_name ${m.version_name})` : ''}`,
    permissions: list(m.permissions),
    host_permissions: list(m.host_permissions),
    optional_permissions: list(m.optional_permissions),
    optional_host_permissions: list(m.optional_host_permissions),
    background: m.background ? JSON.stringify(m.background) : '-',
    action: m.action ? `action ${JSON.stringify(m.action)}` : m.browser_action ? `browser_action ${JSON.stringify(m.browser_action)}` : m.page_action ? `page_action ${JSON.stringify(m.page_action)}` : '-',
    side_panel: m.side_panel ? JSON.stringify(m.side_panel) : m.sidebar_action ? `sidebar_action ${JSON.stringify(m.sidebar_action)}` : '-',
    options: m.options_ui ? JSON.stringify(m.options_ui) : m.options_page ?? '-',
    overrides: m.chrome_url_overrides ? JSON.stringify(m.chrome_url_overrides) : '-',
    devtools_page: m.devtools_page ?? '-',
    sandbox: m.sandbox ? JSON.stringify(m.sandbox) : '-',
    content_scripts: (m.content_scripts ?? []).map((c) => `[${list(c.matches)}] js=${list(c.js)} css=${list(c.css)} run_at=${c.run_at ?? 'default'}${c.world ? ` world=${c.world}` : ''}${c.all_frames ? ' all_frames' : ''}`).join('\n      ') || '-',
    web_accessible_resources: m.web_accessible_resources ? JSON.stringify(m.web_accessible_resources) : '-',
    content_security_policy: m.content_security_policy ? JSON.stringify(m.content_security_policy) : '-',
    commands: m.commands ? Object.keys(m.commands).join(', ') : '-',
    default_locale: m.default_locale ?? '-',
    browser_specific_settings: m.browser_specific_settings ? JSON.stringify(m.browser_specific_settings) : '-',
    externally_connectable: m.externally_connectable ? JSON.stringify(m.externally_connectable) : '-',
    oauth2: m.oauth2 ? 'present' : '-',
    icons: m.icons ? Object.keys(m.icons).join(', ') : 'NONE (add public/icon/<size>.png or @wxt-dev/auto-icons)',
  };
  summaries[t] = s;
  console.log(`\n=== ${t}/manifest.json`);
  for (const [k, v] of Object.entries(s)) if (v !== '-' || full) console.log(`  ${k.padEnd(26)} ${v}`);
  if (t.endsWith('-dev')) {
    console.log('  NOTE: dev build. WXT registers content scripts at runtime in dev (so they may be missing above) and adds the tabs/scripting permissions for reloading. Inspect a production build for the real manifest.');
  }
  if (m.manifest_version === 3 && m.background?.scripts && !m.background?.service_worker) {
    console.log('  NOTE: MV3 background.scripts (event page) is used by Firefox/Safari; Chromium uses background.service_worker.');
  }
  if (t.startsWith('firefox') && !m.browser_specific_settings?.gecko?.id) {
    console.log('  WARN: no browser_specific_settings.gecko.id. Firefox requires it for MV3 and for signing/AMO; set it in wxt.config manifest.');
  }
  if (t.startsWith('firefox') && !m.browser_specific_settings?.gecko?.data_collection_permissions) {
    console.log('  WARN: no gecko.data_collection_permissions. New AMO submissions require it (since Nov 3, 2025).');
  }
  const hosts = [...(m.host_permissions ?? []), ...(m.manifest_version === 2 ? (m.permissions ?? []).filter((p) => p.includes(':')) : [])];
  if (hosts.some((h) => h === '<all_urls>' || /^(\*|https?):\/\/\*\//.test(h))) {
    console.log('  REVIEW: required access to all sites (big install warning, in-depth store review). Consider activeTab or optional_host_permissions.');
  }
  if (!t.endsWith('-dev') && hosts.some((h) => h.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(h))) {
    console.log('  SECURITY: plain http:// host permission. Use https:// where possible.');
  }
  const csp = JSON.stringify(m.content_security_policy ?? '');
  if (!t.endsWith('-dev') && /unsafe-eval|unsafe-inline|https?:\/\//.test(csp)) console.log('  SECURITY: CSP allows eval/inline or remote sources. MV3 stores reject this.');
  const ec = m.externally_connectable?.matches ?? [];
  if (ec.some((x) => x.includes('<all_urls>') || /^(\*|https?):\/\/\*\//.test(x))) console.log('  SECURITY: externally_connectable matches every site. List exact origins.');
  const war = Array.isArray(m.web_accessible_resources) ? m.web_accessible_resources : [];
  if (war.some((w) => typeof w === 'object' && (w.matches ?? []).includes('<all_urls>') && (w.resources ?? []).some((r) => r.endsWith('.html')))) {
    console.log('  SECURITY: an HTML page is web-accessible to every site (clickjacking/fingerprinting). Scope matches; add use_dynamic_url on Chromium.');
  }
  if (full) console.log(JSON.stringify(m, null, 2));
}

if (targets.length > 1) {
  console.log('\n=== Differences between targets');
  const keys = Object.keys(summaries[targets[0]]);
  let any = false;
  for (const k of keys) {
    const values = targets.map((t) => summaries[t][k]);
    if (new Set(values).size > 1) {
      any = true;
      console.log(`  ${k}:`);
      targets.forEach((t, i) => console.log(`    ${t.padEnd(20)} ${values[i]}`));
    }
  }
  if (!any) console.log('  none');
}
