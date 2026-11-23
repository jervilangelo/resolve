/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { expect, test } from '../fixtures/extension';

test('popup reports live feature status from the background worker', async ({
  page,
  extensionId,
}) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('img', { name: 'Resolve' })).toBeVisible();
  const features = page.getByRole('list', { name: 'Protection features' });
  await expect(features.getByRole('listitem')).toHaveCount(3);
  await expect(features).toContainText('Not yet available');
});

test('options page renders', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Protection features' })).toBeVisible();
});
