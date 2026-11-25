/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, chromium, expect, test } from '@playwright/test';
import { browserLaunchOptions } from '../fixtures/browser';

/**
 * The extension with the optional `webNavigation` permission already granted (as after a user
 * turns on accountability alerts). Its listeners register at worker start-up, so a mistake there
 * would stop the whole background service; this guards that path.
 */
const build = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/extension/.output/chrome-mv3',
);

let context: BrowserContext;
let extensionId: string;
let dir: string;

test.beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'resolve-alerts-'));
  cpSync(build, dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { permissions: string[] };
  manifest.permissions.push('webNavigation');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  context = await chromium.launchPersistentContext('', {
    ...browserLaunchOptions(),
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context.close();
  rmSync(dir, { recursive: true, force: true });
});

test('the background service answers with blocked-visit alerts granted', async () => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole('list', { name: 'Protection features' })).toBeVisible();
  await expect(popup.getByText('Could not reach the Resolve background service')).toHaveCount(0);
  // Signed out: alerts are granted but cannot report yet, and the status says so.
  await expect(popup.getByText(/On, but inactive/)).toBeVisible();
});

test('settings show alerts as granted with an honest status', async () => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(
    options.getByLabel('Alert my accountability partners about blocked visits'),
  ).toBeChecked();
  await expect(options.getByText(/Status: on, but inactive \(sign in to report\)/)).toBeVisible();
});
