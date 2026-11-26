/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { existsSync, readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import { ALL_FOCUS_PATTERNS } from './lib/focus';

const icons = {
  16: 'icon/icon-16.png',
  32: 'icon/icon-32.png',
  48: 'icon/icon-48.png',
  96: 'icon/icon-96.png',
  128: 'icon/icon-128.png',
};

/**
 * RESOLVE_* settings from .env files, in Vite's precedence order. This one result feeds both the
 * manifest's host permissions and the runtime (via `define`), so they can never diverge.
 */
function loadSettings(mode: string): Record<string, string> {
  // The beta build talks to production, like store builds.
  const stage = mode === 'beta' ? 'production' : mode;
  const files = ['.env', '.env.local', `.env.${stage}`, `.env.${stage}.local`];
  const settings: Record<string, string> = {};
  for (const file of files.filter((f) => existsSync(f))) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = /^(RESOLVE_[A-Z_]+)=(.*)$/.exec(line.trim());
      if (match?.[1]) settings[match[1]] = match[2] ?? '';
    }
  }
  return settings;
}

/**
 * The dashboard origin that may ask for the checklist status (externally_connectable). HTTPS, or
 * localhost for development; anything else grants nothing.
 */
function dashboardMatches(settings: Record<string, string>): string[] {
  try {
    const url = new URL(settings.RESOLVE_DASHBOARD_URL ?? '');
    const local = url.protocol === 'http:' && url.hostname === 'localhost';
    return url.protocol === 'https:' || local ? [`${url.protocol}//${url.hostname}/*`] : [];
  } catch {
    return [];
  }
}

/** Only HTTPS origins of the API and Cognito domain; anything else grants nothing. */
function hostPermissions(settings: Record<string, string>): string[] {
  return [settings.RESOLVE_API_URL, settings.RESOLVE_COGNITO_DOMAIN].flatMap((value) => {
    try {
      const url = new URL(value ?? '');
      return url.protocol === 'https:' ? [`${url.origin}/*`] : [];
    } catch {
      return [];
    }
  });
}

// Chrome, Brave and Edge share the Chromium MV3 build; Firefox gets its own MV3 build (`-b firefox`).
// Permissions are added only with the features that need them (docs/MASTER_PLAN.md §13):
// `identity` for Cognito sign-in; `declarativeNetRequest` to block group domains (block/allow
// rules need no host access); `alarms` for periodic rule sync. Session data lives in the extension
// origin's IndexedDB, which needs no permission and is unreachable from content scripts.
// The on-device media filter (Chromium) adds `scripting` to register its content script,
// `offscreen` for the classifier document, and site access to all pages as an *optional*
// permission requested only when the user turns the filter on. Reporting blocked visits to
// accountability partners needs `webNavigation`, also optional and requested only on opt-in.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  vite: (env) => ({
    plugins: [tailwindcss()],
    define: { __RESOLVE_SETTINGS__: JSON.stringify(loadSettings(env.mode)) },
  }),
  manifest: ({ browser, mode }) => ({
    name: 'Resolve',
    description: 'In development: privacy-first browser protection and voluntary accountability.',
    permissions: [
      'identity',
      'declarativeNetRequest',
      'alarms',
      ...(browser === 'firefox' ? [] : ['scripting', 'offscreen']),
    ],
    host_permissions: hostPermissions(loadSettings(mode)),
    // Only the dashboard may message the extension, and only to ask for the checklist status.
    ...(browser !== 'firefox' &&
      dashboardMatches(loadSettings(mode)).length > 0 && {
        externally_connectable: { matches: dashboardMatches(loadSettings(mode)) },
      }),
    ...(browser !== 'firefox' && {
      optional_host_permissions: ['<all_urls>'],
      // Requested only when the user turns on alerts for blocked visits (Trigger A).
      optional_permissions: ['webNavigation'],
      // Focus Mode redirects blocked sites to its own page (with site access, see lib/focus.ts).
      // Visible to these sites only (a redirect needs it); use_dynamic_url would break redirects.
      web_accessible_resources: [{ resources: ['focus.html'], matches: ALL_FOCUS_PATTERNS }],
    }),
    // Development and beta builds carry a fixed public key so their unpacked extension IDs (and
    // therefore their registered Cognito callbacks) are stable. Store builds get their ID from
    // the store and carry no key.
    ...(mode === 'development' && { key: readFileSync('dev-key.pub.txt', 'utf8').trim() }),
    ...(mode === 'beta' && { key: readFileSync('beta-key.pub.txt', 'utf8').trim() }),
    // Firefox: sign-in stores account credentials and the account email locally; no browsing data
    // is collected. The built-in consent prompt requires Firefox 140+. (Firefox sign-in is
    // disabled until a Gecko ID and its callback are registered; see lib/config.ts.)
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          strict_min_version: '140.0',
          data_collection_permissions: {
            required: ['authenticationInfo', 'personallyIdentifyingInfo'],
          },
        },
      },
    }),
    icons,
    action: { default_title: 'Resolve', default_icon: { 16: icons[16], 32: icons[32] } },
  }),
});
