/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browserLaunchOptions } from '../fixtures/browser';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { type IncomingHttpHeaders, type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, type Page, chromium, expect, test } from '@playwright/test';

/**
 * The on-device media filter in real Chromium, against local pages only. Fixture photos are
 * harmless; `flagged-cat-nose` is a close-up the model misreads as explicit (score ≈ 0.85), which
 * exercises the "keep blurred" path without explicit material. Chromium's network log of the
 * whole browser proves that no media, scores or anything else leave for any other host.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const media = path.join(here, '../fixtures/media');
const build = path.join(here, '../../../apps/extension/.output/chrome-mv3');
const ATTR = 'data-resolve-media';

interface Hit {
  method: string;
  url: string;
  dest: string | undefined;
  headers: IncomingHttpHeaders;
  bodyBytes: number;
}

function serve(handler: (url: URL) => { type: string; body: Buffer | string } | null) {
  const hits: Hit[] = [];
  const server = createServer((req, res) => {
    let bodyBytes = 0;
    req.on('data', (chunk: Buffer) => (bodyBytes += chunk.length));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      hits.push({
        method: req.method ?? '',
        url: url.pathname + url.search,
        dest: req.headers['sec-fetch-dest'],
        headers: req.headers,
        bodyBytes,
      });
      const found = handler(url);
      if (!found) {
        res.writeHead(404).end();
        return;
      }
      const body = Buffer.from(found.body);
      const headers = { 'content-type': found.type, 'accept-ranges': 'bytes' };
      // Media elements read video in byte ranges.
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
        res.writeHead(206, {
          ...headers,
          'content-range': `bytes ${String(start)}-${String(end)}/${String(body.length)}`,
        });
        res.end(body.subarray(start, end + 1));
        return;
      }
      res.writeHead(200, headers);
      res.end(body);
    });
  });
  return new Promise<{ server: Server; port: number; hits: Hit[] }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as AddressInfo).port, hits });
    });
  });
}

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.webm': 'video/webm' };
function mediaFile(url: URL) {
  const name = path.basename(url.pathname);
  const type = TYPES[path.extname(name)];
  if (!url.pathname.startsWith('/media/') || !type) return null;
  try {
    return { type, body: readFileSync(path.join(media, name)) };
  } catch {
    return null;
  }
}

const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="#334"/></svg>';

function testPage(crossOrigin: string): string {
  const dataJpeg = `data:image/jpeg;base64,${readFileSync(path.join(media, 'safe-forest.jpg')).toString('base64')}`;
  return `<!doctype html><html><head><title>media filter test</title></head><body>
<img id="same-safe" src="/media/safe-forest.jpg">
<img id="same-flagged" src="/media/flagged-cat-nose.jpg">
<img id="cross-safe" src="${crossOrigin}/media/safe-dog.jpg">
<img id="cross-flagged" src="${crossOrigin}/media/flagged-cat-nose.jpg?cross">
<img id="data-safe" src="${dataJpeg}">
<img id="vector" src="/logo.svg">
<img id="tiny" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==">
<img id="broken" src="/missing.jpg">
<img id="preset" data-resolve-media="safe" src="/media/flagged-cat-nose.jpg?preset">
<video id="video-safe" src="/media/safe-forest.webm" muted autoplay playsinline width="320"></video>
<video id="video-flagged" src="/media/flagged-cat-nose.webm" muted autoplay playsinline width="320"></video>
<video id="video-cross" src="${crossOrigin}/media/safe-forest.webm" muted autoplay playsinline width="320"></video>
<div style="height:4000px"></div>
<img id="lazy" loading="lazy" src="/media/safe-dog.jpg?lazy">
<script>
setTimeout(() => {
  const image = new Image();
  image.id = 'dynamic';
  image.src = '/media/safe-dog.jpg?dynamic';
  document.body.prepend(image);
}, 300);
</script>
</body></html>`;
}

/** The build with site access pre-granted, as after the user accepts the browser's prompt. */
function grantedBuild(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'resolve-ext-'));
  cpSync(build, dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  manifest.host_permissions = [...(manifest.host_permissions as string[]), '<all_urls>'];
  writeFileSync(manifestPath, JSON.stringify(manifest));
  return dir;
}

const state = (page: Page, id: string) => page.locator(`#${id}`);
const filterOf = (page: Page, id: string) =>
  state(page, id).evaluate((element) => getComputedStyle(element).filter);

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let extensionId: string;
let extensionDir: string;
let netLog: string;
let pageServer: Awaited<ReturnType<typeof serve>>;
let crossServer: Awaited<ReturnType<typeof serve>>;

test.beforeAll(async () => {
  crossServer = await serve(mediaFile);
  const crossOrigin = `http://127.0.0.1:${String(crossServer.port)}`;
  pageServer = await serve((url) => {
    if (url.pathname === '/page.html') return { type: 'text/html', body: testPage(crossOrigin) };
    if (url.pathname === '/logo.svg') return { type: 'image/svg+xml', body: LOGO_SVG };
    return mediaFile(url);
  });
  extensionDir = grantedBuild();
  netLog = path.join(extensionDir, 'netlog.json');
  context = await chromium.launchPersistentContext('', {
    ...browserLaunchOptions(),
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      `--log-net-log=${netLog}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context.close().catch(() => undefined);
  pageServer.server.close();
  crossServer.server.close();
  rmSync(extensionDir, { recursive: true, force: true });
});

test('the filter is off until the user turns it on in settings', async () => {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${String(pageServer.port)}/page.html`);
  await page.waitForTimeout(1500);
  expect(await filterOf(page, 'same-flagged')).toBe('none');
  expect(await state(page, 'same-flagged').getAttribute(ATTR)).toBeNull();
  await page.close();

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByLabel('Blur sensitive images and videos').click();
  await expect(options.getByRole('status').filter({ hasText: 'Status:' })).toHaveText('Status: On');
  await expect(options.getByLabel(/Balanced/)).toBeChecked();
  await options.close();
});

test('blurs flagged media, releases safe media, and follows the page as it changes', async () => {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${String(pageServer.port)}/page.html`);

  // Below the fold and not yet loaded: blurred, not yet checked.
  expect(await state(page, 'lazy').getAttribute(ATTR)).toBeNull();
  expect(await filterOf(page, 'lazy')).toContain('blur');

  const timeout = { timeout: 30_000 };
  for (const id of [
    'same-safe',
    'cross-safe',
    'data-safe',
    'vector',
    'tiny',
    'broken',
    'dynamic',
  ]) {
    await expect(state(page, id), id).toHaveAttribute(ATTR, 'safe', timeout);
  }
  // Markup cannot pre-mark itself as checked.
  for (const id of ['same-flagged', 'cross-flagged', 'preset']) {
    await expect(state(page, id), id).toHaveAttribute(ATTR, 'blur', timeout);
    expect(await filterOf(page, id)).toContain('blur');
  }
  expect(await filterOf(page, 'same-safe')).toBe('none');

  // Videos are sampled only while visible.
  expect(await state(page, 'video-safe').getAttribute(ATTR)).toBeNull();
  await state(page, 'video-safe').scrollIntoViewIfNeeded();
  await expect(state(page, 'video-safe')).toHaveAttribute(ATTR, 'safe', timeout);
  await state(page, 'video-flagged').scrollIntoViewIfNeeded();
  await expect(state(page, 'video-flagged')).toHaveAttribute(ATTR, 'blur', timeout);
  // A cross-origin video's frames are withheld from extensions: the "keep blurred" default applies.
  await state(page, 'video-cross').scrollIntoViewIfNeeded();
  await expect(state(page, 'video-cross')).toHaveAttribute(ATTR, 'unverified', timeout);

  await state(page, 'lazy').scrollIntoViewIfNeeded();
  await expect(state(page, 'lazy')).toHaveAttribute(ATTR, 'safe', timeout);

  // A reused element must not keep its previous verdict.
  await state(page, 'same-safe').evaluate((image: HTMLImageElement) => {
    image.src = '/media/flagged-cat-nose.jpg?swapped';
  });
  // A clone of a checked image inherits nothing, even while its new source is still loading.
  const cloneBlurred = await state(page, 'dynamic').evaluate((image: HTMLImageElement) => {
    const clone = image.cloneNode() as HTMLImageElement;
    clone.id = 'clone';
    clone.src = '/media/flagged-cat-nose.jpg?clone';
    document.body.prepend(clone);
    return new Promise<string>((resolve) =>
      requestAnimationFrame(() => {
        resolve(getComputedStyle(clone).filter);
      }),
    );
  });
  expect(cloneBlurred).toContain('blur');
  await state(page, 'clone').scrollIntoViewIfNeeded();
  await expect(state(page, 'clone')).toHaveAttribute(ATTR, 'blur', timeout);

  // Blurred again at once, and re-checked when it is next on screen.
  await expect(state(page, 'same-safe')).not.toHaveAttribute(ATTR, 'safe');
  expect(await filterOf(page, 'same-safe')).toContain('blur');
  await state(page, 'same-safe').scrollIntoViewIfNeeded();
  await expect(state(page, 'same-safe')).toHaveAttribute(ATTR, 'blur', timeout);
  await page.close();
});

test('turning the filter off stops it on newly opened pages', async () => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByLabel('Blur sensitive images and videos').click();
  await expect(options.getByRole('status').filter({ hasText: 'Status:' })).toHaveText(
    'Status: Off',
  );
  await options.close();

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${String(pageServer.port)}/page.html`);
  await page.waitForTimeout(1500);
  expect(await filterOf(page, 'same-flagged')).toBe('none');
  await page.close();
});

test('no media or results leave the browser', async () => {
  await context.close();
  // Every request any part of the browser made (pages, extension worker, offscreen document).
  const log = JSON.parse(readFileSync(netLog, 'utf8')) as {
    constants: { logEventTypes: Record<string, number> };
    events: {
      type: number;
      params?: { url?: string; initiator?: string; network_isolation_key?: string };
    }[];
  };
  const startJob = log.constants.logEventTypes.URL_REQUEST_START_JOB;
  const requests = log.events
    .filter((event) => event.type === startJob)
    .map((event) => event.params ?? {})
    .filter((params) => /^(https?|wss?):/.test(params.url ?? ''));
  const hostOf = (params: { url?: string }) => new URL(params.url ?? '').host;
  const local = [pageServer.port, crossServer.port].map((port) => `127.0.0.1:${String(port)}`);
  expect(requests.map(hostOf)).toContain(local[0]); // the log really captured this session

  // Requests made by the extension or by the test pages: all to the local test servers only.
  const extensionOrigin = `chrome-extension://${extensionId}`;
  const ours = requests.filter((params) =>
    [params.initiator, params.network_isolation_key].some(
      (value) =>
        (value?.includes(extensionOrigin) ?? false) || local.some((host) => value?.includes(host)),
    ),
  );
  expect(ours.length).toBeGreaterThan(0);
  expect([...new Set(ours.map(hostOf))].filter((host) => !local.includes(host))).toEqual([]);
  // Playwright's Chromium has no vendor background services, so there the whole browser must
  // stay local. Branded browsers (Edge, Brave) contact their vendors on their own.
  if ((process.env.RESOLVE_E2E_BROWSER ?? 'chromium') === 'chromium') {
    expect([...new Set(requests.map(hostOf))].filter((host) => !local.includes(host))).toEqual([]);
  }

  const hits = [...pageServer.hits, ...crossServer.hits];
  // Only reads: nothing is ever sent to a server, not even the page's own.
  expect(hits.filter((hit) => hit.method !== 'GET' || hit.bodyBytes > 0)).toEqual([]);
  // The extension re-reads only cross-origin images it cannot read in the page, without cookies.
  const extensionReads = hits.filter((hit) => hit.dest === 'empty');
  expect(extensionReads.map((hit) => hit.url).sort()).toEqual(
    ['/media/flagged-cat-nose.jpg?cross', '/media/safe-dog.jpg'].sort(),
  );
  expect(extensionReads.every((hit) => hit.headers.cookie === undefined)).toBe(true);
  expect(extensionReads.every((hit) => hit.headers.referer === undefined)).toBe(true);
});
