/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, type Page, type Worker, chromium } from '@playwright/test';
import { browserLaunchOptions } from '../fixtures/browser';
import { expect, test } from '../fixtures/extension';

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- chrome.* and IndexedDB inside the extension */
declare const chrome: any; // eslint-disable-line @typescript-eslint/no-explicit-any

const built = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/extension/.output/chrome-mv3',
);
const GROUP = 'grp_aaaaaaaaaaaaaaaaaaaaaaaaaa';
const ESSENTIAL = ['youtube.com', 'safe.casino.example'];

/**
 * The extension with `webNavigation` granted (as after opting in to blocked-visit alerts) and
 * without site access, in a profile where every host resolves to a local server.
 */
async function withExtension<T>(
  run: (ctx: { context: BrowserContext; sw: Worker; ui: Page; requests: string[] }) => Promise<T>,
) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'resolve-blocked-'));
  cpSync(built, dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { permissions: string[] };
  manifest.permissions.push('webNavigation');
  writeFileSync(manifestPath, JSON.stringify(manifest));

  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(`${req.headers.host ?? ''}${req.url ?? ''}`);
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<title>site</title><p>site</p>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const context = await chromium.launchPersistentContext('', {
    ...browserLaunchOptions(),
    args: [
      `--disable-extensions-except=${dir}`,
      `--load-extension=${dir}`,
      `--host-resolver-rules=MAP * 127.0.0.1:${String(port)}`,
    ],
  });
  try {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    // Let the startup sync finish (with no group it clears group-range rules).
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const ui = await context.newPage();
    await ui.goto(`chrome-extension://${new URL(sw.url()).host}/options.html`);
    return await run({ context, sw, ui, requests });
  } finally {
    await context.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Installs a group block rule as the protection controller does (essentials exempt). */
async function installGroupRule(sw: Worker, domains: string[]) {
  const rule = {
    id: 3,
    priority: 1,
    action: { type: 'block' },
    condition: {
      requestDomains: domains,
      excludedRequestDomains: ESSENTIAL,
      resourceTypes: ['main_frame', 'sub_frame'],
    },
  };
  await sw.evaluate(
    (r) => chrome.declarativeNetRequest.updateDynamicRules({ addRules: [r] }),
    rule,
  );
  return rule;
}

/** A signed-in session with an active group and that group's synced snapshot (local only). */
async function signInWithGroup(ui: Page, rule: unknown) {
  await ui.evaluate(
    ([groupId, r]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('resolve', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('private');
        open.onsuccess = () => {
          const tx = open.result.transaction('private', 'readwrite');
          const store = tx.objectStore('private');
          store.put(
            {
              sid: 'test-sid',
              accessToken: 'test-access',
              refreshToken: 'test-refresh',
              expiresAt: Math.floor(Date.now() / 1000) + 3600,
              email: null,
              activeGroupId: groupId,
            },
            'session',
          );
          store.put(
            {
              groupId,
              ruleVersion: 1,
              essentialVersion: 'e1',
              syncedAt: Date.now(),
              rules: [r],
            },
            'protection',
          );
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => {
            reject(tx.error ?? new Error('write failed'));
          };
        };
      }),
    [GROUP, rule] as const,
  );
}

async function configured(ui: Page): Promise<boolean> {
  const state = (await ui.evaluate(() => chrome.runtime.sendMessage({ type: 'account/get' }))) as {
    state: string;
  };
  return state.state !== 'unconfigured';
}

async function startFocus(ui: Page) {
  const none = { youtube: false, netflix: false, twitch: false };
  await ui.evaluate(
    (o) => chrome.runtime.sendMessage({ type: 'focus/start', minutes: 25, optional: o }),
    none,
  );
}

/** Opens `url` in a new tab and returns it once the navigation settled or was swapped. */
async function visit(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url).catch(() => undefined);
  return page;
}

const ruleIds = (sw: Worker) =>
  sw.evaluate(() =>
    chrome.declarativeNetRequest
      .getDynamicRules()
      .then((r: { id: number }[]) => r.map((x) => x.id)),
  ) as Promise<number[]>;

test('a Focus-only block shows the Focus page with the time left, never the site', async () => {
  await withExtension(async ({ context, sw, ui, requests }) => {
    await startFocus(ui);
    const page = await visit(context, 'http://www.facebook.com/some/path?q=secret');
    await page.waitForURL(/\/focus\.html\?from=block$/);
    await expect(page.getByRole('heading', { name: 'Focus Mode is On' })).toBeVisible();
    await expect(page.getByRole('timer')).toHaveText(/^(2[45]):\d\d left$/);
    await expect(page.getByText('Ephesians 5:16 (KJV)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go Back' })).toHaveCount(0);
    expect(await page.content()).not.toMatch(/facebook|secret/i);
    expect(requests.some((r) => r.includes('facebook'))).toBe(false);
    expect(await ruleIds(sw)).toEqual([100_001]);

    // Back steps past the blocked entry to the previous page instead of looping.
    const tab = await visit(context, 'http://news.example/');
    await tab.goto('http://www.instagram.com/').catch(() => undefined);
    await tab.waitForURL(/\/focus\.html\?from=block$/);
    await tab.evaluate(() => {
      history.back();
    });
    await expect.poll(() => tab.url(), { timeout: 10_000 }).toBe('http://news.example/');
    await expect(tab.getByText('site')).toBeVisible();
  });
});

test('a group block shows Access Blocked, takes precedence over Focus, and keeps exemptions', async () => {
  await withExtension(async ({ context, sw, ui, requests }) => {
    test.skip(!(await configured(ui)), 'group protection needs a configured build');
    const rule = await installGroupRule(sw, ['casino.example', 'facebook.com']);
    await signInWithGroup(ui, rule);

    const page = await visit(context, 'http://www.casino.example/table?id=7');
    await page.waitForURL(/\/blocked\.html$/);
    await expect(page.getByRole('heading', { name: 'Access Blocked' })).toBeVisible();
    await expect(
      page.getByText('This page is blocked by Resolve. Please stay away from this website.'),
    ).toBeVisible();
    await expect(page.getByText('You made a commitment to guard your heart.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose to Walk Away' })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue|ignore|unlock/i })).toHaveCount(0);
    expect(await page.content()).not.toMatch(/casino|table|id=7/i);
    expect(await page.locator('figcaption').textContent()).toMatch(/^— .+/);

    // Walking away closes the tab when the window has others.
    const closed = page.waitForEvent('close');
    await page.getByRole('button', { name: 'Choose to Walk Away' }).click();
    await closed;

    // Both a running Focus session and the group cover facebook.com: the group page wins.
    await startFocus(ui);
    const both = await visit(context, 'http://www.facebook.com/');
    await both.waitForURL(/\/blocked\.html$/);

    // An essential service is exempt from the group rule and is never swapped.
    const essential = await visit(context, 'http://safe.casino.example/');
    await expect(essential.getByText('site')).toBeVisible();
    expect(essential.url()).toBe('http://safe.casino.example/');

    expect(requests.some((r) => /^(www\.)?(casino|facebook)\./.test(r))).toBe(false);
    expect((await ruleIds(sw)).sort((a, b) => a - b)).toEqual([3, 100_001]);
  });
});

test('Access Blocked varies its reflection and quotation between visits', async () => {
  await withExtension(async ({ context, ui }) => {
    const url = ui.url().replace('options.html', 'blocked.html');
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const page = await context.newPage();
      await page.goto(url);
      seen.push(
        `${await page.locator('main p').nth(1).textContent()}|${await page.locator('blockquote').textContent()}`,
      );
      await page.close();
    }
    for (let i = 1; i < seen.length; i++) {
      const [r0, q0] = (seen[i - 1] ?? '').split('|');
      const [r1, q1] = (seen[i] ?? '').split('|');
      expect(r1).not.toBe(r0);
      expect(q1).not.toBe(q0);
    }
  });
});

test('the Access Blocked page is not reachable from websites', () => {
  const manifest = JSON.parse(readFileSync(path.join(built, 'manifest.json'), 'utf8')) as {
    web_accessible_resources?: { resources: string[] }[];
  };
  const exposed = (manifest.web_accessible_resources ?? []).flatMap((w) => w.resources);
  expect(exposed).not.toContain('blocked.html');
});
