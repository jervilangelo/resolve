/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startMediaFilter } from '@/lib/media/filter';
import type { ContentConfig, ContentRequest, MediaSource, Verdict } from '@/lib/media/protocol';

// This script runs in every frame of every page, so replies are checked by hand rather than with
// the schema library the extension pages use, keeping the injected bundle small.
const VERDICTS: readonly unknown[] = ['blur', 'show', 'unverified', 'busy'] satisfies Verdict[];

const field = (reply: unknown, key: string): unknown =>
  typeof reply === 'object' && reply !== null ? (reply as Record<string, unknown>)[key] : undefined;

async function config(): Promise<ContentConfig> {
  const reply: unknown = await browser.runtime.sendMessage({
    type: 'media/config',
  } satisfies ContentRequest);
  const enabled = field(reply, 'enabled');
  const unverifiable = field(reply, 'unverifiable');
  if (typeof enabled !== 'boolean' || (unverifiable !== 'blur' && unverifiable !== 'show')) {
    throw new Error('Unexpected media filter configuration');
  }
  return { enabled, unverifiable };
}

async function classify(source: MediaSource): Promise<Verdict> {
  const reply: unknown = await browser.runtime.sendMessage({
    type: 'media/classify',
    source,
  } satisfies ContentRequest);
  const verdict = field(reply, 'verdict');
  return VERDICTS.includes(verdict) ? (verdict as Verdict) : 'unverified';
}

// Registered at runtime (lib/media/registration.ts), only while the on-device media filter is on
// and the user has granted site access, so the manifest itself requests no host access.
export default defineContentScript({
  matches: [],
  registration: 'runtime',
  main() {
    startMediaFilter(document, { config, classify });
  },
});
