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

const NONE = { youtube: false, netflix: false, twitch: false };
type Optional = typeof NONE;

async function worker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}

/** Starts a session through the extension's own message channel (no permission prompt). */
async function startFocus(page: Page, optional: Optional = NONE, minutes = 25) {
  return page.evaluate(
    ([o, m]) => chrome.runtime.sendMessage({ type: 'focus/start', minutes: m, optional: o }),
    [optional, minutes] as const,
  ) as Promise<{ enforcement: string; session: { endsAt: number } | null }>;
}

async function endFocus(page: Page) {
  return page.evaluate(() => chrome.runtime.sendMessage({ type: 'focus/end' })) as Promise<{
    enforcement: string;
  }>;
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

    expect((await startFocus(ui)).enforcement).toBe('on');
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

    await endFocus(ui);
    await startFocus(ui, { youtube: true, netflix: false, twitch: true });
    expect(await blocked(context, url('www.youtube.com') + 'watch?v=x')).toBe(true);
    expect(await blocked(context, url('youtu.be') + 'x')).toBe(true);
    expect(await blocked(context, url('www.twitch.tv'))).toBe(true);
    expect(await blocked(context, url('www.netflix.com'))).toBe(false);
    // Google sign-in passes through accounts.youtube.com; it stays reachable.
    expect(await blocked(context, url('accounts.youtube.com'))).toBe(false);

    expect((await endFocus(ui)).enforcement).toBe('off');
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
  await expect(popup.getByRole('button', { name: /Start Focus · 25 min/ })).toBeVisible();
  for (const name of ['YouTube', 'Netflix', 'Twitch']) {
    await expect(popup.getByRole('button', { name: `Also block ${name}` })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  }

  await startFocus(popup);
  await popup.reload();
  await expect(popup.getByRole('timer')).toHaveText(/^2[45]:\d\d$/);
  await endFocus(popup);
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
  await expect(page.getByText('Is this worth breaking your focus for?')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Resolve' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close this Tab' })).toBeVisible();
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
      (s) => chrome.runtime.sendMessage({ type: 'focus/start', ...s }),
      { minutes: 25, optional: NONE },
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
    await startFocus(ui, { youtube: false, netflix: true, twitch: false }, 60);
    await context.close();

    context = await launch();
    sw = await worker(context);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    // The session survived the restart with its deadline: still running, close to 60 minutes.
    await expect(popup.getByRole('timer')).toHaveText(/^5\d:\d\d$/);
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

test('the popup starts a session, counts down, and ends early only after both steps', async ({
  context,
  extensionId,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  // Skip the one-time site-access prompt (a native dialog Playwright cannot answer).
  await popup.evaluate(() => {
    localStorage.setItem('focusAccessAsked', '1');
  });
  await popup.reload();

  await popup.getByRole('button', { name: '15', exact: true }).click();
  await popup.getByRole('button', { name: 'Also block YouTube' }).click();
  await expect(popup.getByRole('button', { name: 'Also block YouTube' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await popup.getByRole('button', { name: /Start Focus · 15 min/ }).click();
  const timer = popup.getByRole('timer');
  await expect(timer).toHaveText(/^1[45]:\d\d$/);
  const first = await timer.textContent();
  await popup.waitForTimeout(2200);
  expect(await timer.textContent()).not.toBe(first);
  await expect(popup.getByRole('progressbar')).toBeVisible();

  // Step 1: only the exact phrase continues (pasting is blocked, so it is typed).
  await popup.getByRole('button', { name: 'End early' }).click();
  await expect(popup.getByText('Is this an emergency?')).toBeVisible();
  const phrase = popup.getByLabel('Is this an emergency?');
  const proceed = popup.getByRole('button', { name: 'Continue' });
  for (const wrong of [
    'yes, this is an emergency.',
    'Yes, this is an emergency',
    'Yes this is an emergency.',
  ]) {
    await phrase.fill(wrong);
    await expect(proceed).toBeDisabled();
  }
  await phrase.fill('Yes, this is an emergency.');
  await expect(proceed).toBeEnabled();
  await proceed.click();

  // Step 2: No returns to the running countdown.
  await expect(popup.getByText('Are you sure you want to end Focus Mode early?')).toBeVisible();
  await popup.getByRole('button', { name: 'No — Keep Focusing' }).click();
  await expect(popup.getByRole('button', { name: 'End early' })).toBeVisible();
  await expect(timer).toHaveText(/^1[45]:\d\d$/);

  // Back through both steps; Yes ends it, and the setup view returns with the choices kept.
  await popup.getByRole('button', { name: 'End early' }).click();
  await popup.getByLabel('Is this an emergency?').fill('Yes, this is an emergency.');
  await popup.getByRole('button', { name: 'Continue' }).click();
  await popup.getByRole('button', { name: 'Yes — End Focus Mode' }).click();
  await expect(popup.getByRole('button', { name: /Start Focus · 15 min/ })).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Also block YouTube' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const sw = await worker(context);
  const ids = (await sw.evaluate(() =>
    chrome.declarativeNetRequest
      .getDynamicRules()
      .then((r: { id: number }[]) => r.map((x) => x.id)),
  )) as number[];
  expect(ids.filter((id) => id >= 100_000)).toEqual([]);
});

test('a session ends by itself at its deadline, with no popup open, and while ending early', async ({
  context,
  extensionId,
}) => {
  const sw = await worker(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(() => {
    localStorage.setItem('focusAccessAsked', '1');
  });
  await page.reload();
  const focusRules = () =>
    sw.evaluate(() =>
      chrome.declarativeNetRequest
        .getDynamicRules()
        .then((r: { id: number }[]) => r.filter((x) => x.id >= 100_000).length),
    ) as Promise<number>;

  /** Moves the running session's stored deadline a few seconds ahead (5 minutes is the floor). */
  const shortenTo = (ms: number) =>
    sw.evaluate(async (delay) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('resolve', 1);
        open.onsuccess = () => {
          resolve(open.result);
        };
        open.onerror = () => {
          reject(new Error('indexedDB open failed'));
        };
      });
      const store = () => db.transaction('private', 'readwrite').objectStore('private');
      const value = await new Promise<{ session: { endsAt: number } }>((resolve) => {
        const get = store().get('focus');
        get.onsuccess = () => {
          resolve(get.result as { session: { endsAt: number } });
        };
      });
      const endsAt = Date.now() + delay;
      value.session.endsAt = endsAt;
      await new Promise((resolve) => {
        store().put(value, 'focus').onsuccess = resolve;
      });
      await chrome.alarms.create('focus-end', { when: endsAt });
    }, ms);

  // 1. The alarm ends it with the popup closed.
  await startFocus(page);
  await page.close();
  expect(await focusRules()).toBe(1);
  await shortenTo(3000);
  await expect.poll(focusRules, { timeout: 15_000 }).toBe(0);

  // 2. Expiry while the user is on step 1 of ending early dismisses the steps.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await startFocus(popup);
  await popup.reload();
  await popup.getByRole('button', { name: 'End early' }).click();
  await expect(popup.getByText('Is this an emergency?')).toBeVisible();
  await shortenTo(3000);
  await expect(popup.getByRole('button', { name: /Start Focus/ })).toBeVisible({ timeout: 15_000 });
  await expect(popup.getByText('Is this an emergency?')).toHaveCount(0);
  expect(await focusRules()).toBe(0);
});

test('a custom duration starts with a single click on Start', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.evaluate(() => {
    localStorage.setItem('focusAccessAsked', '1');
  });
  await popup.reload();
  await popup.getByRole('button', { name: 'Custom' }).click();
  const input = popup.getByLabel('Custom duration in minutes');
  await input.fill('4');
  await expect(popup.getByRole('button', { name: /Start Focus/ })).toBeDisabled();
  await input.fill('90');
  await popup.getByRole('button', { name: /Start Focus · 90 min/ }).click();
  await expect(popup.getByRole('timer')).toHaveText(/^(90:00|89:\d\d)$/);
});
