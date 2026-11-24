/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { PrivateStore } from '../private-store';
import { DEFAULT_FILTER_SETTINGS, type FilterSettings, filterSettingsSchema } from './protocol';

/**
 * The filter's settings and whether its content script is registered. Reading pages needs host
 * access to every site, which the extension does not hold at install: it is an optional permission
 * the options page requests when the user turns the filter on, and the user can withdraw it in
 * the browser at any time. The content script runs only while the filter is on and access is held.
 */
export type FilterStatus =
  | 'off'
  | 'on'
  /** Turned on, but the browser's site access was not granted or was withdrawn. */
  | 'needsAccess'
  /** This browser lacks what the filter needs (e.g. offscreen documents). */
  | 'unsupported';

export interface FilterState {
  settings: FilterSettings;
  status: FilterStatus;
}

export interface ScriptRegistration {
  isRegistered(): Promise<boolean>;
  register(): Promise<void>;
  unregister(): Promise<void>;
}

const SETTINGS_KEY = 'mediaFilter';

export function createFilterController(deps: {
  store: PrivateStore;
  supported: boolean;
  hasSiteAccess(): Promise<boolean>;
  registration: ScriptRegistration;
}) {
  const { store, registration } = deps;
  let queue: Promise<unknown> = Promise.resolve();

  /** Serializes changes so overlapping toggles cannot leave the registration out of step. */
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.catch(() => undefined).then(task);
    queue = run;
    return run;
  }

  async function settings(): Promise<FilterSettings> {
    const parsed = filterSettingsSchema.safeParse(await store.get(SETTINGS_KEY));
    return parsed.success ? parsed.data : DEFAULT_FILTER_SETTINGS;
  }

  async function status(current: FilterSettings): Promise<FilterStatus> {
    if (!deps.supported) return 'unsupported';
    if (!current.enabled) return 'off';
    return (await deps.hasSiteAccess()) ? 'on' : 'needsAccess';
  }

  async function reconcile(): Promise<FilterState> {
    const current = await settings();
    const next = await status(current);
    const registered = await registration.isRegistered();
    if (next === 'on' && !registered) await registration.register();
    if (next !== 'on' && registered) await registration.unregister();
    return { settings: current, status: next };
  }

  return {
    settings,
    /** Read-only status for content scripts: no registration changes, no queueing. */
    async status(): Promise<FilterState> {
      const current = await settings();
      return { settings: current, status: await status(current) };
    },
    state: () => serial(reconcile),
    /** Brings the registration in line with settings and site access (startup, permission change). */
    reconcile: () => serial(reconcile),
    update: (next: FilterSettings) =>
      serial(async () => {
        await store.set(SETTINGS_KEY, filterSettingsSchema.parse(next));
        return reconcile();
      }),
  };
}

export type FilterController = ReturnType<typeof createFilterController>;
