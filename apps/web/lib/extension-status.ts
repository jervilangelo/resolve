/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { useEffect, useState } from 'react';
import { publicEnv } from './env';

/**
 * What the Resolve extension in this browser says about itself, for the setup checklist. The
 * extension answers only this dashboard's origin, and only with two yes/no facts.
 *
 * - `checking`: asking;
 * - `absent`: no Resolve extension answered (not installed, another browser, or a browser that
 *   does not let pages talk to extensions);
 * - otherwise its answer.
 */
export interface BrowserDetails {
  version: string;
  activeGroupId: string | null;
  protection: 'off' | 'starting' | 'idle' | 'on' | 'stale' | 'error';
  syncedAt: number | null;
  media: 'off' | 'on' | 'needsAccess' | 'unsupported';
  alerts: 'on' | 'off' | 'inactive' | 'unsupported';
}

export type ExtensionStatus =
  | { state: 'checking' }
  | { state: 'absent' }
  | {
      state: 'present';
      signedIn: boolean;
      mediaBlur: boolean;
      /** Absent from extension versions before 0.1.1. */
      details: BrowserDetails | null;
    };

const PROTECTION = ['off', 'starting', 'idle', 'on', 'stale', 'error'] as const;
const MEDIA = ['off', 'on', 'needsAccess', 'unsupported'] as const;
const ALERTS = ['on', 'off', 'inactive', 'unsupported'] as const;

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((a) => a === value) ?? null;
}

function details(r: Record<string, unknown>): BrowserDetails | null {
  const protection = pick(r.protection, PROTECTION);
  const media = pick(r.media, MEDIA);
  const alerts = pick(r.alerts, ALERTS);
  if (!protection || !media || !alerts || typeof r.version !== 'string') return null;
  return {
    version: r.version,
    activeGroupId: typeof r.activeGroupId === 'string' ? r.activeGroupId : null,
    protection,
    syncedAt: typeof r.syncedAt === 'number' ? r.syncedAt : null,
    media,
    alerts,
  };
}

interface ChromeRuntime {
  sendMessage(id: string, message: unknown, callback: (response: unknown) => void): void;
  lastError?: unknown;
}

function runtime(): ChromeRuntime | undefined {
  const chrome = (globalThis as { chrome?: { runtime?: Partial<ChromeRuntime> } }).chrome;
  return typeof chrome?.runtime?.sendMessage === 'function'
    ? (chrome.runtime as ChromeRuntime)
    : undefined;
}

const TIMEOUT_MS = 1500;

function ask(rt: ChromeRuntime, id: string): Promise<ExtensionStatus | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(null);
    }, TIMEOUT_MS);
    try {
      rt.sendMessage(id, { type: 'dashboard/status' }, (response: unknown) => {
        clearTimeout(timer);
        // Reading lastError marks it handled (no extension with this ID, or it did not answer).
        if (rt.lastError || !response || typeof response !== 'object') {
          resolve(null);
          return;
        }
        const record = response as Record<string, unknown>;
        const { signedIn, mediaBlur } = record;
        if (typeof signedIn !== 'boolean' || typeof mediaBlur !== 'boolean') {
          resolve(null);
          return;
        }
        resolve({ state: 'present', signedIn, mediaBlur, details: details(record) });
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Configured extension IDs (beta and store builds), from NEXT_PUBLIC_EXTENSION_IDS. */
export function extensionIds(): string[] {
  return (publicEnv.NEXT_PUBLIC_EXTENSION_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[a-p]{32}$/.test(id));
}

/** Asks each configured extension ID; the first that answers wins. */
export function useExtensionStatus(): ExtensionStatus {
  const [status, setStatus] = useState<ExtensionStatus>({ state: 'checking' });
  useEffect(() => {
    const run = { cancelled: false };
    const rt = runtime();
    const ids = extensionIds();
    void (async () => {
      let found: ExtensionStatus | null = null;
      if (rt) {
        for (const id of ids) {
          found = await ask(rt, id);
          if (found) break;
        }
      }
      if (!run.cancelled) setStatus(found ?? { state: 'absent' });
    })();
    return () => {
      run.cancelled = true;
    };
  }, []);
  return status;
}
