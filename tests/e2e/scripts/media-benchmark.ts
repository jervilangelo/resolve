/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

/* eslint-disable no-console -- a command-line report */

// Browser performance of the media filter (docs/AI_FILTER_EVALUATION.md).
//
//   node scripts/media-benchmark.ts <image-dir> [--headed]
//
// Needs a production build (apps/extension/.output/chrome-mv3) and a folder of JPEG photos (at
// least 24). Measures, in real Chromium: classifier cold start, warm per-image latency through
// the whole extension path, time until a 24-image page is fully checked, and main-thread
// blocking time on that page with the filter off and on.

import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type BrowserContext, chromium } from '@playwright/test';

/** The few extension APIs the benchmark calls inside the service worker. */
interface WorkerChrome {
  runtime: { sendMessage(message: unknown): Promise<unknown> };
  offscreen: {
    createDocument(options: {
      url: string;
      reasons: string[];
      justification: string;
    }): Promise<void>;
    closeDocument(): Promise<void>;
  };
}

const [imageDir, flag] = process.argv.slice(2);
if (!imageDir) throw new Error('Usage: node scripts/media-benchmark.ts <image-dir> [--headed]');
const images = readdirSync(imageDir)
  .filter((f) => /\.jpe?g$/i.test(f))
  .slice(0, 24);
if (images.length < 24) throw new Error('Need at least 24 JPEG images');

const page = `<!doctype html><title>bench</title><style>img{width:220px;height:165px;object-fit:cover}</style>
<script>
window.__blocking = 0;
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) window.__blocking += Math.max(0, entry.duration - 50);
}).observe({ type: 'longtask', buffered: true });
</script>
${images.map((f, i) => `<img src="/img/${f}?n=${String(i)}">`).join('\n')}`;

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' }).end(page);
    return;
  }
  const name = path.basename(url.pathname);
  if (!images.includes(name)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': 'image/jpeg' }).end(readFileSync(path.join(imageDir, name)));
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;

const build = path.join(import.meta.dirname, '../../../apps/extension/.output/chrome-mv3');
const dir = mkdtempSync(path.join(tmpdir(), 'resolve-bench-'));
cpSync(build, dir, { recursive: true });
const manifestPath = path.join(dir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { host_permissions: string[] };
manifest.host_permissions.push('<all_urls>');
writeFileSync(manifestPath, JSON.stringify(manifest));

const context: BrowserContext = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: flag !== '--headed',
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
});
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const extensionId = new URL(worker.url()).host;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)] ?? 0;

async function loadPage(filterOn: boolean): Promise<{ settleMs: number; blockingMs: number }> {
  const tab = await context.newPage();
  const start = Date.now();
  await tab.goto(origin);
  // Scroll through so every image becomes visible and gets checked.
  await tab.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
  await (filterOn
    ? tab.waitForFunction(
        () => [...document.images].every((img) => img.hasAttribute('data-resolve-media')),
        undefined,
        { timeout: 120_000 },
      )
    : tab.waitForLoadState('load'));
  const settleMs = Date.now() - start;
  const blockingMs = await tab.evaluate(
    () => (window as unknown as { __blocking: number }).__blocking,
  );
  await tab.close();
  return { settleMs, blockingMs };
}

try {
  const off = await loadPage(false);

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByLabel('Blur sensitive images and videos').click();
  await options.getByText('Status: On').waitFor();
  await options.close();

  // From the worker straight to the offscreen document (the message the background queue sends).
  const timings = await worker.evaluate(
    async ({ base, files }) => {
      const { chrome } = globalThis as unknown as { chrome: WorkerChrome };
      const send = (url: string) =>
        chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'classify',
          source: { kind: 'url', url },
        });
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'benchmark',
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      let t = performance.now();
      await send(`${base}/img/${files[0]}?cold`);
      const cold = performance.now() - t;
      const warm: number[] = [];
      for (const [i, file] of files.entries()) {
        t = performance.now();
        await send(`${base}/img/${file}?warm=${String(i)}`);
        warm.push(performance.now() - t);
      }
      return { cold, warm };
    },
    { base: origin, files: images },
  );
  await worker.evaluate(() =>
    (globalThis as unknown as { chrome: WorkerChrome }).chrome.offscreen.closeDocument(),
  );

  const onCold = await loadPage(true); // offscreen document recreated on demand
  const onWarm = await loadPage(true);
  console.log(
    `Chromium ${context.browser()?.version() ?? ''}, ${flag === '--headed' ? 'headed' : 'headless'}`,
  );
  console.log(`Classifier cold start (load model + first image): ${timings.cold.toFixed(0)} ms`);
  console.log(
    `Warm per-image latency (fetch + decode + inference): median ${median(timings.warm).toFixed(0)} ms, p95 ${p95(timings.warm).toFixed(0)} ms`,
  );
  console.log(
    '24-image page, until every image is checked; main-thread blocking (long tasks >50 ms):',
  );
  console.log(
    `  filter off:            loaded ${String(off.settleMs)} ms, blocking ${off.blockingMs.toFixed(0)} ms`,
  );
  console.log(
    `  filter on, cold model: settled ${String(onCold.settleMs)} ms, blocking ${onCold.blockingMs.toFixed(0)} ms`,
  );
  console.log(
    `  filter on, warm model: settled ${String(onWarm.settleMs)} ms, blocking ${onWarm.blockingMs.toFixed(0)} ms`,
  );
} finally {
  await context.close();
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
