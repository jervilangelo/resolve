/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const icons = {
  16: 'icon/icon-16.png',
  32: 'icon/icon-32.png',
  48: 'icon/icon-48.png',
  96: 'icon/icon-96.png',
  128: 'icon/icon-128.png',
};

// Chrome, Brave and Edge share the Chromium MV3 build; Firefox gets its own MV3 build (`-b firefox`).
// Permissions are added only with the features that need them (docs/MASTER_PLAN.md §13).
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: ({ browser }) => ({
    name: 'Resolve',
    description: 'In development: privacy-first browser protection and voluntary accountability.',
    // Firefox AMO requires a data-collection declaration; this build collects nothing.
    ...(browser === 'firefox' && {
      browser_specific_settings: { gecko: { data_collection_permissions: { required: ['none'] } } },
    }),
    icons,
    action: { default_title: 'Resolve', default_icon: { 16: icons[16], 32: icons[32] } },
  }),
});
