/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browser } from 'wxt/browser';
import type { ScriptRegistration } from './controller';
import { type MediaSource, type OffscreenResponse, offscreenResponseSchema } from './protocol';

/** Browser plumbing for the media filter (Chromium): content script registration and offscreen. */

export const SITE_ACCESS = { origins: ['<all_urls>'] };
const SCRIPT_ID = 'media-filter';

/** Firefox has no offscreen documents; the filter is Chromium-only until a Firefox adapter. */
export const supportsMediaFilter = (): boolean => {
  const api = browser as Partial<typeof browser>;
  return (
    typeof api.offscreen?.createDocument === 'function' &&
    typeof api.scripting?.registerContentScripts === 'function'
  );
};

export const hasSiteAccess = (): Promise<boolean> => browser.permissions.contains(SITE_ACCESS);

export const scriptRegistration: ScriptRegistration = {
  async isRegistered() {
    return (await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] })).length > 0;
  },
  async register() {
    await browser.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        js: ['content-scripts/content.js'],
        matches: ['<all_urls>'],
        allFrames: true,
        // Also about:blank, blob: and similar frames, which inherit their creator's origin.
        matchOriginAsFallback: true,
        // Before the page paints, so media starts blurred rather than flashing.
        runAt: 'document_start',
        persistAcrossSessions: true,
      },
    ]);
  },
  async unregister() {
    await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  },
};

const OFFSCREEN_URL = 'offscreen.html';
let creating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  const url = browser.runtime.getURL(`/${OFFSCREEN_URL}`);
  const existing = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url],
  });
  if (existing.length > 0) return;
  creating ??= browser.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: ['WORKERS'],
      justification: 'Runs the on-device image classifier; no media leaves the browser.',
    })
    .catch(async (error: unknown) => {
      // Another caller may have created it first.
      const again = await browser.runtime.getContexts({ documentUrls: [url] });
      if (again.length === 0) throw error;
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}

/** Waits between attempts while a new document starts up or a closed one is recreated. */
const RETRY_DELAYS_MS = [0, 100, 300, 1000];

/** Sends one classification to the offscreen document, (re)creating it as needed. */
export async function classifyOffscreen(source: MediaSource): Promise<OffscreenResponse> {
  let lastError: unknown;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await ensureOffscreen();
      const reply: unknown = await browser.runtime.sendMessage({
        target: 'offscreen',
        type: 'classify',
        source,
      });
      return offscreenResponseSchema.parse(reply);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
