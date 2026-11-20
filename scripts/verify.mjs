#!/usr/bin/env node
/**
 * End-to-end smoke verification for Payout Lens.
 *
 *   npm run build && npm run verify
 *
 * Builds the production bundle, serves it with `vite preview`, and checks
 * that the page loads (HTTP 200) and contains the key UI text. Exits
 * non-zero on any failure. Math is covered separately by `npm test`.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITE_BIN = path.join(ROOT, 'node_modules', '.bin', 'vite');

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/`;

const HTML_MUST_CONTAIN = [
  'Payout Lens', // <title>
  'id="root"',
];

const JS_MUST_CONTAIN = [
  'Leak detector',
  'Weekly scorecard',
  'Per-order breakdown',
  'Fee stack',
  'Payout trend',
  'Where each',
  '16,582.51',
  'Import payout data',
  'Export reconciled report',
  'SWG-1001', // bundled sample data
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return res;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error(`Server did not respond on ${BASE} after ${tries} tries`);
}

const preview = spawn(VITE_BIN, ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  stdio: 'pipe',
  cwd: ROOT,
});
let previewLog = '';
preview.stdout?.on('data', (d) => (previewLog += d));
preview.stderr?.on('data', (d) => (previewLog += d));

let failed = false;
try {
  const res = await waitForServer();
  console.log(`GET ${BASE} -> HTTP ${res.status}`);
  if (res.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${res.status}`);
  }
  const html = await res.text();
  const missing = HTML_MUST_CONTAIN.filter((s) => !html.includes(s));
  if (missing.length > 0) {
    throw new Error(`Page HTML is missing expected text: ${missing.join(', ')}`);
  }
  console.log(`OK: HTML shell contains title + root (${HTML_MUST_CONTAIN.length} checks).`);

  // The JS bundle must also be served — the app is client-rendered, so
  // confirm the built asset responds too.
  const assetMatch = html.match(/\/assets\/index-[^"]+\.js/);
  if (!assetMatch) throw new Error('No built JS asset referenced in HTML');
  const assetRes = await fetch(`http://127.0.0.1:${PORT}${assetMatch[0]}`);
  console.log(`GET ${assetMatch[0]} -> HTTP ${assetRes.status}`);
  if (assetRes.status !== 200) {
    throw new Error(`Built JS asset returned ${assetRes.status}`);
  }
  const js = await assetRes.text();
  // The charts are lazy-loaded (code-split), so their strings live in a
  // separate chunk. Fetch every built JS chunk over HTTP and check the
  // union — this proves all chunks are actually served, not just present.
  const { readdirSync } = await import('node:fs');
  const chunkNames = readdirSync(path.join(ROOT, 'dist', 'assets'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => `assets/${f}`);
  let allJs = js;
  for (const chunk of chunkNames) {
    if (`/${chunk}` === assetMatch[0]) continue; // already fetched
    const chunkRes = await fetch(`http://127.0.0.1:${PORT}/${chunk}`);
    if (chunkRes.status !== 200) {
      throw new Error(`Built JS chunk ${chunk} returned ${chunkRes.status}`);
    }
    allJs += await chunkRes.text();
  }
  const jsMissing = JS_MUST_CONTAIN.filter((s) => !allJs.includes(s));
  if (jsMissing.length > 0) {
    throw new Error(`Built JS is missing expected strings: ${jsMissing.join(', ')}`);
  }
  console.log(`OK: built JS bundles serve and contain app content (${(allJs.length / 1024).toFixed(0)} KB total, ${JS_MUST_CONTAIN.length} checks).`);
  console.log('VERIFY PASSED');
} catch (err) {
  failed = true;
  console.error(`VERIFY FAILED: ${err.message}`);
  if (previewLog.trim()) console.error(`--- vite preview output ---\n${previewLog}`);
} finally {
  preview.kill('SIGTERM');
  await sleep(300);
  if (!preview.killed) preview.kill('SIGKILL');
}

process.exit(failed ? 1 : 0);
