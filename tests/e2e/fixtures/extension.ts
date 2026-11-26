/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browserLaunchOptions } from './browser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, test as base, chromium } from '@playwright/test';

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/extension/.output/chrome-mv3',
);

/** Loads the built Chromium extension into a fresh persistent profile. */
export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      ...browserLaunchOptions(),
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    await use(id);
  },
});

export const expect = test.expect;
