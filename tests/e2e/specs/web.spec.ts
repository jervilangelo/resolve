/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('home page leads with the logo as its heading and the availability line', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Resolve/);
  // The hero heading is the logo; its accessible name is the brand.
  await expect(page.getByRole('heading', { level: 1, name: 'Resolve' })).toBeVisible();
  await expect(page.locator('h1 img[src*="horizontal-light.svg"]')).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByRole('heading', { level: 1, name: 'Resolve' })).toBeVisible();
  await expect(page.locator('h1 img[src*="horizontal-dark.svg"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Resolve home' })).toBeVisible();
  await expect(page.getByText('Free · No ads · Chrome, Edge and Brave')).toBeVisible();
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
  // The landing page has its own dark hero; the shared site header is on the other pages.
  await page.goto('/privacy');
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
      '/tutorial',
      '/about',
      '/faq',
      '/downloads',
    ]) {
      test(`${path} in ${scheme} mode has no violations`, async ({ page }) => {
        // Reduced motion: contrast is measured on the settled page, not mid-animation.
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
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
    ['About', 'About Resolve'],
    ['Tutorial', 'How to use Resolve'],
    ['FAQ', 'Frequently asked questions'],
    ['Download', 'Download Resolve'],
    ['Support Resolve', 'Help keep Resolve available'],
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

test('the tutorial covers the whole journey with described media', async ({ page }) => {
  await page.goto('/tutorial');
  for (const name of [
    'Get Resolve',
    'Install the extension',
    'Sign in and check it is ready',
    'Blur sensitive images',
    'Use Focus Mode',
    'Groups and website restrictions',
    'Accountability alerts',
    'The two blocked screens',
    'Fix common problems',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  const images = page.locator('article img');
  expect(await images.count()).toBeGreaterThanOrEqual(12);
  for (const alt of await images.evaluateAll((els) => els.map((e) => e.getAttribute('alt')))) {
    expect((alt ?? '').length).toBeGreaterThan(20);
  }
  await expect(page.locator('video track[kind="captions"]')).toHaveCount(1);
  // Keyboard: the section links move focus through the contents list.
  await page
    .getByRole('navigation', { name: 'Tutorial sections' })
    .getByRole('link', { name: 'Use Focus Mode' })
    .click();
  await expect(page).toHaveURL(/#focus$/);
  expect(await page.content()).not.toMatch(/demo\.(member|partner|guest)@/);
  // Old links keep working.
  await page.goto('/getting-started');
  await expect(page).toHaveURL(/\/tutorial$/);
});

test('about page has the new opening, the builder note and no 2 Corinthians quotation', async ({
  page,
}) => {
  await page.goto('/about');
  await expect(page.getByText('Resolve is for Christians who want to be diligent')).toBeVisible();
  await expect(page.getByText('Like any tool, Resolve can be bypassed.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View my portfolio' })).toHaveAttribute(
    'href',
    'https://jervilangelo.online',
  );
  await expect(page.locator('main')).not.toContainText('2 Corinthians');
});

test('the FAQ has no Limitations category but keeps account and security answers', async ({
  page,
}) => {
  await page.goto('/faq');
  await expect(page.getByRole('heading', { name: 'Limitations' })).toHaveCount(0);
  await expect(page.getByText('How do I delete my account?')).toBeVisible();
  await expect(page.getByText('How do I report a security or privacy problem?')).toBeVisible();
});

test('the Support page shows the GCash QR code with what scanning opens', async ({ page }) => {
  await page.goto('/support');
  const qr = page.getByRole('img', { name: 'GCash InstaPay QR code for donations to Resolve' });
  await expect(qr).toBeVisible();
  expect(await qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText(/opens a money\s+transfer to Jervil Angelo De Leon/)).toBeVisible();
  await expect(page.getByText('The GCash QR code will appear here soon.')).toHaveCount(0);
});

test('the landing page features Focus Mode with a link to its tutorial steps', async ({ page }) => {
  await page.goto('/');
  const features = page.locator('#features');
  await expect(features.getByRole('heading', { name: 'Focus Mode' })).toBeVisible();
  await expect(features.getByText('Temporarily block distracting websites')).toBeVisible();
  await expect(features.getByRole('link', { name: 'How Focus Mode works' })).toHaveAttribute(
    'href',
    '/tutorial#focus',
  );
});
