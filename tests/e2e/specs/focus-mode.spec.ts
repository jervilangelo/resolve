/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, type Page, type Worker, chromium } from '@playwright/test';
import { browserLaunchOptions } from '../fixtures/browser';
import { expect, test } from '../fixtures/extension';

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/extension/.output/chrome-mv3',
);

/**
 * The extension in a profile where every host name resolves to a local server, so navigations
 * take the browser's real network path (where declarativeNetRequest applies); Playwright routing
 * would bypass the extension's rules.
 */
async function withLocalSites<T>(
  run: (context: BrowserContext, base: (host: string) => string) => Promise<T>,
) {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<title>site</title><p>site</p>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const context = await chromium.launchPersistentContext('', {
    ...browserLaunchOptions(),
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      `--host-resolver-rules=MAP * 127.0.0.1:${String(port)}`,
    ],
  });
  try {
    return await run(context, (host) => `http://${host}/`);
  } finally {
    await context.close();
    server.close();
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- chrome.* inside the extension */
declare const chrome: any; // eslint-disable-line @typescript-eslint/no-explicit-any

const OFF = { enabled: false, optional: { youtube: false, netflix: false, twitch: false } };
const ON = { ...OFF, enabled: true };

async function worker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}

/** Changes Focus settings through the extension's own message channel (no permission prompt). */
async function setFocus(page: Page, settings: typeof OFF) {
  return page.evaluate(
    (s) => chrome.runtime.sendMessage({ type: 'focus/set', settings: s }),
    settings,
  ) as Promise<{ enforcement: string }>;
}

/**
 * True when the extension blocked the navigation. Any network-level outcome (a page, or a TLS
 * error because HSTS-preloaded sites upgrade to HTTPS) means the request left the browser.
 */
async function blocked(context: BrowserContext, url: string): Promise<boolean> {
  const page = await context.newPage();
  try {
    await page.goto(url);
    return false;
  } catch (error) {
    const message = String(error);
    if (message.includes('ERR_BLOCKED_BY_CLIENT')) return true;
    if (/ERR_(SSL|CONNECTION|CERT)_/.test(message)) return false;
    throw error;
  } finally {
    await page.close();
  }
}

test('Focus Mode blocks its sites alongside group rules and turns off without touching them', async () => {
  await withLocalSites(async (context, url) => {
    const sw = await worker(context);
    const extensionId = new URL(sw.url()).host;
    // Let the extension's startup sync finish (with no group it clears group-range rules).
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // A group rule exactly as the protection controller installs it (essential services exempt).
    await sw.evaluate(() =>
      chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [
          {
            id: 3,
            priority: 1,
            action: { type: 'block' },
            condition: {
              requestDomains: ['casino.example', 'reddit.com'],
              excludedRequestDomains: ['youtube.com', 'facebook.com'],
              resourceTypes: ['main_frame', 'sub_frame'],
            },
          },
        ],
      }),
    );

    const ruleIds = () =>
      sw.evaluate(() =>
        chrome.declarativeNetRequest
          .getDynamicRules()
          .then((r: { id: number }[]) => r.map((x) => x.id)),
      ) as Promise<number[]>;
    expect(await ruleIds()).toEqual([3]);

    const ui = await context.newPage();
    await ui.goto(`chrome-extension://${extensionId}/options.html`);

    expect(await blocked(context, url('www.facebook.com'))).toBe(false);
    expect(await blocked(context, url('casino.example'))).toBe(true);

    expect((await setFocus(ui, ON)).enforcement).toBe('on');
    for (const address of [
      url('www.facebook.com'),
      url('m.facebook.com'),
      url('www.instagram.com'),
      url('x.com') + 'home',
      url('twitter.com'),
      url('mobile.twitter.com'),
      url('www.tiktok.com'),
      url('old.reddit.com'),
    ]) {
      expect(await blocked(context, address), address).toBe(true);
    }
    for (const address of [
      url('www.youtube.com'),
      url('www.netflix.com'),
      url('www.twitch.tv'),
      url('www.messenger.com'),
      url('example.com'),
      url('accounts.google.com'),
    ]) {
      expect(await blocked(context, address), address).toBe(false);
    }
    // The group rule keeps working while Focus is on.
    expect(await blocked(context, url('casino.example'))).toBe(true);

    await setFocus(ui, { ...ON, optional: { youtube: true, netflix: false, twitch: true } });
    expect(await blocked(context, url('www.youtube.com') + 'watch?v=x')).toBe(true);
    expect(await blocked(context, url('youtu.be') + 'x')).toBe(true);
    expect(await blocked(context, url('www.twitch.tv'))).toBe(true);
    expect(await blocked(context, url('www.netflix.com'))).toBe(false);
    // Google sign-in passes through accounts.youtube.com; it stays reachable.
    expect(await blocked(context, url('accounts.youtube.com'))).toBe(false);

    expect((await setFocus(ui, OFF)).enforcement).toBe('off');
    expect(await blocked(context, url('www.facebook.com'))).toBe(false);
    expect(await blocked(context, url('www.youtube.com'))).toBe(false);
    // Group protection is untouched: its rule is still installed and still blocks.
    expect(await blocked(context, url('casino.example'))).toBe(true);
    expect(await blocked(context, url('www.reddit.com'))).toBe(true);
    const ids = (await sw.evaluate(() =>
      chrome.declarativeNetRequest
        .getDynamicRules()
        .then((r: { id: number }[]) => r.map((x) => x.id)),
    )) as number[];
    expect(ids).toEqual([3]);
  });
});

test('Focus Mode sends no network requests and the popup shows the enforced state', async ({
  context,
  extensionId,
}) => {
  const requests: string[] = [];
  context.on('request', (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('Focus Mode is Off')).toBeVisible();
  await expect(popup.getByRole('switch', { name: 'Focus Mode' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  for (const name of ['YouTube', 'Netflix', 'Twitch']) {
    await expect(popup.getByRole('switch', { name: `Also block ${name}` })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  }

  await setFocus(popup, ON);
  await popup.reload();
  await expect(popup.getByText('Focus Mode is On')).toBeVisible();
  await expect(popup.getByRole('switch', { name: 'Focus Mode' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await setFocus(popup, OFF);
  // Nothing about Focus Mode leaves the browser (the API and Cognito hosts are the only ones
  // the extension can contact; neither is called for Focus).
  expect(requests).toEqual([]);
});

test('the Focus page is branded, never names the site, and offers no way to turn Focus off', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/focus.html`);
  await expect(page.getByRole('heading', { level: 1, name: 'Focus Mode is On' })).toBeVisible();
  await expect(page.getByText('You’ve chosen to limit distractions.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Resolve' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close this tab' })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('http');
});

test('with site access, blocked sites and already-open tabs show the Focus page', async () => {
  const { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  // The same build with site access already granted (as after the user accepts the prompt).
  const granted = mkdtempSync(path.join(tmpdir(), 'resolve-focus-'));
  cpSync(extensionPath, granted, { recursive: true });
  const manifestPath = path.join(granted, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    host_permissions?: string[];
    web_accessible_resources: { matches: string[] }[];
  };
  manifest.host_permissions = [
    ...(manifest.host_permissions ?? []),
    ...(manifest.web_accessible_resources[0]?.matches ?? []),
  ];
  writeFileSync(manifestPath, JSON.stringify(manifest));

  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<title>site</title><p>site</p>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const context = await chromium.launchPersistentContext('', {
    ...browserLaunchOptions(),
    args: [
      `--disable-extensions-except=${granted}`,
      `--load-extension=${granted}`,
      `--host-resolver-rules=MAP * 127.0.0.1:${String(port)}`,
      '--ignore-certificate-errors',
    ],
  });
  try {
    const sw = await worker(context);
    const extensionId = new URL(sw.url()).host;
    // A tab already on a site that Focus will block (served before Focus is on).
    const open = await context.newPage();
    // HSTS sends it to HTTPS, which the local server cannot serve; the tab still shows reddit.com.
    await open.goto('http://www.reddit.com/').catch(() => undefined);
    const ui = await context.newPage();
    await ui.goto(`chrome-extension://${extensionId}/popup.html`);
    const state = (await ui.evaluate(
      (s) => chrome.runtime.sendMessage({ type: 'focus/set', settings: s }),
      ON,
    )) as { enforcement: string; focusPage: boolean };
    expect(state).toMatchObject({ enforcement: 'on', focusPage: true });
    await expect(open).toHaveURL(/^chrome-extension:\/\/[a-p]{32}\/focus\.html\?from=open$/);

    const page = await context.newPage();
    await page.goto('http://www.instagram.com/').catch(() => undefined);
    await expect(page).toHaveURL(/^chrome-extension:\/\/[a-p]{32}\/focus\.html$/);
    await expect(page.getByRole('heading', { name: 'Focus Mode is On' })).toBeVisible();
  } finally {
    await context.close();
    server.close();
    rmSync(granted, { recursive: true, force: true });
  }
});

test('Focus Mode stays on, and keeps blocking, after the browser restarts', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const profile = mkdtempSync(path.join(tmpdir(), 'resolve-profile-'));
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      ...browserLaunchOptions(),
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
  try {
    let context = await launch();
    let sw = await worker(context);
    const extensionId = new URL(sw.url()).host;
    const ui = await context.newPage();
    await ui.goto(`chrome-extension://${extensionId}/popup.html`);
    await setFocus(ui, { ...ON, optional: { youtube: false, netflix: true, twitch: false } });
    await context.close();

    context = await launch();
    sw = await worker(context);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByText('Focus Mode is On')).toBeVisible();
    await expect(popup.getByRole('switch', { name: 'Also block Netflix' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const domains = (await sw.evaluate(() =>
      chrome.declarativeNetRequest
        .getDynamicRules()
        .then((r: { condition: { requestDomains?: string[] } }[]) =>
          r.flatMap((x) => x.condition.requestDomains ?? []),
        ),
    )) as string[];
    expect(domains).toEqual(expect.arrayContaining(['facebook.com', 'netflix.com']));
    await context.close();
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
});
