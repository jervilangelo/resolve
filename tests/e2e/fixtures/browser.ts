/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

/**
 * Which Chromium-family browser runs the extension tests. CI uses Playwright's Chromium; locally,
 * `RESOLVE_E2E_BROWSER=msedge` or `=brave` (with Brave at its default Windows path, or
 * `RESOLVE_E2E_BROWSER_PATH`) runs the same specs in those browsers (MASTER_PLAN §14.3).
 */
export function browserLaunchOptions(): { channel?: string; executablePath?: string } {
  const choice = process.env.RESOLVE_E2E_BROWSER ?? 'chromium';
  if (choice === 'brave') {
    return {
      executablePath:
        process.env.RESOLVE_E2E_BROWSER_PATH ??
        'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    };
  }
  return { channel: choice };
}
