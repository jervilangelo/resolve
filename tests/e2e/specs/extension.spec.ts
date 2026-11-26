/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../fixtures/extension';

test('popup reports live feature status from the background worker', async ({
  page,
  extensionId,
}) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('img', { name: 'Resolve' })).toBeVisible();
  const features = page.getByRole('list', { name: 'Protection features' });
  await expect(features.getByRole('listitem')).toHaveCount(3);
  // CI builds have no sign-in settings, so only browser support is asserted here.
  await expect(features).not.toContainText('Not supported in this browser');
});

test('options page renders', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Protection features' })).toBeVisible();
});

for (const pageName of ['popup', 'options']) {
  test(`${pageName} page has no accessibility violations (WCAG 2.1 A/AA)`, async ({
    page,
    extensionId,
  }) => {
    await page.goto(`chrome-extension://${extensionId}/${pageName}.html`);
    await page.getByRole('list', { name: 'Protection features' }).waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
