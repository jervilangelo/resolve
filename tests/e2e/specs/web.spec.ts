/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('home page renders brand, tagline and development-status notice', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Resolve/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Take every thought captive.');
  await expect(page.getByRole('link', { name: 'Resolve home' })).toBeVisible();
  await expect(page.getByText('not yet publicly available')).toBeVisible();
  expect(errors).toEqual([]);
});

test('no horizontal overflow', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('dark theme swaps to the dark logo artwork', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('header img[src*="-dark.svg"]')).toBeVisible();
  await expect(page.locator('header img[src*="-light.svg"]')).toBeHidden();
});

test('unknown routes return the branded 404', async ({ page }) => {
  const response = await page.goto('/does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('security headers are set', async ({ request }) => {
  const response = await request.get('/');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['x-powered-by']).toBeUndefined();
  const csp = response.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain('unsafe-eval');
});

test.describe('accessibility (WCAG 2.1 A/AA, axe)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const path of [
      '/',
      '/does-not-exist',
      '/privacy',
      '/terms',
      '/support',
      '/getting-started',
    ]) {
      test(`${path} in ${scheme} mode has no violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      });
    }
  }
});

test('public information pages render and are linked from every page', async ({ page }) => {
  await page.goto('/');
  for (const [label, heading] of [
    ['Getting started', 'Getting started'],
    ['Support', 'Support'],
    ['Privacy', 'Privacy policy'],
    ['Terms', 'Terms of use'],
  ] as const) {
    await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  // The privacy policy states the core guarantee plainly.
  await page.goto('/privacy');
  await expect(page.getByText('never uploaded to Resolve or anyone else')).toBeVisible();
});
