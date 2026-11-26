/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const isCI = Boolean(process.env.CI);

// Requires built apps: `pnpm build` at the repository root.
export default defineConfig({
  testDir: './specs',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${String(PORT)}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'web', testMatch: 'web.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'web-mobile', testMatch: 'web.spec.ts', use: { ...devices['Pixel 7'] } },
    // Extension pages need a persistent Chromium context; see fixtures/extension.ts.
    {
      name: 'extension',
      testMatch: [
        'extension.spec.ts',
        'extension-alerts.spec.ts',
        'media-filter.spec.ts',
        'focus-mode.spec.ts',
      ],
    },
  ],
  webServer: {
    command: `pnpm --filter @resolve/web exec next start --port ${String(PORT)}`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
