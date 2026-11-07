#!/usr/bin/env node
// Inspect and drive the existing WXT Chrome. Never launches a second browser.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const port = process.env.WXT_CDP_PORT || '9222';
const endpoint = `http://127.0.0.1:${port}`;
const command = process.argv[2] || 'status';
const args = process.argv.slice(3);

async function metadata() {
  const response = await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw new Error(`CDP returned HTTP ${response.status}`);
  return response.json();
}

async function ensure() {
  try {
    await metadata();
    console.log(`Using running Chrome at ${endpoint}`);
    return;
  } catch { /* Start the dev server below. */ }
  const logDir = join(process.cwd(), '.wxt');
  await mkdir(logDir, { recursive: true });
  const log = openSync(join(logDir, 'dev-cdp.log'), 'a');
  const child = spawn('pnpm dev', { cwd: process.cwd(), shell: true, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  closeSync(log);
  child.unref();
  console.log(`Started pnpm dev (PID ${child.pid}); waiting for ${endpoint}`);
  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try { await metadata(); console.log('CDP is ready'); return; } catch { /* Still starting. */ }
  }
  throw new Error(`CDP did not appear. Check ${join(logDir, 'dev-cdp.log')}`);
}

if (command === 'ensure') {
  await ensure();
  process.exit(0);
}

let browser;
try {
  const targets = await metadata();
  if (command === 'status') {
    for (const target of targets.filter((item) => item.type === 'page')) {
      console.log(JSON.stringify({ title: target.title, url: target.url, id: target.id }));
    }
    process.exit(0);
  }
  browser = await chromium.connectOverCDP(endpoint);
  const pages = browser.contexts().flatMap((context) => context.pages());
  const panel = pages.find((page) => /^chrome-extension:\/\/[^/]+\/sidepanel\.html(?:\?|$)/.test(page.url()));
  if (!panel) throw new Error('No extension side panel target. Open the side panel, then retry. If Chrome is gone, run ensure.');

  if (command === 'inspect') {
    console.log(`Title: ${await panel.title()}\nURL: ${panel.url()}`);
    console.log((await panel.locator('body').innerText()).slice(0, 12000));
  } else if (command === 'screenshot') {
    const path = args[0] || join(process.cwd(), '.wxt', 'sidepanel.png');
    await panel.screenshot({ path });
    console.log(path);
  } else if (command === 'pair') {
    // Read the link from stdin to avoid putting a pairing credential in process arguments.
    if (process.stdin.isTTY) console.log('Paste the pairing link, then press Enter:');
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const link = input.trim();
    if (!link) throw new Error('No pairing link on stdin. Run opencode pair --url <server URL>, then pipe its link into this command.');
    const field = panel.getByRole('textbox', { name: 'Pairing link or code' });
    await field.fill(link);
    await panel.getByRole('button', { name: 'Connect with link' }).click();
    await panel.waitForTimeout(1500);
    console.log((await panel.locator('body').innerText()).slice(0, 4000));
  } else {
    throw new Error('Usage: node scripts/dev-cdp.mjs [status|ensure|inspect|screenshot [path]|pair]');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
