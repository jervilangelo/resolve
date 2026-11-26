/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import type { PrivateStore } from '../private-store';
import { createFilterController } from './controller';
import { DEFAULT_FILTER_SETTINGS } from './protocol';

function memoryStore(): PrivateStore {
  const map = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(map.get(key)),
    set: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
    update: (key, change) => {
      const next = change(map.get(key));
      if (next === undefined) map.delete(key);
      else map.set(key, next);
      return Promise.resolve(next);
    },
  };
}

function setup({ supported = true, access = true } = {}) {
  let registered = false;
  let granted = access;
  const store = memoryStore();
  const filter = createFilterController({
    store,
    supported,
    hasSiteAccess: () => Promise.resolve(granted),
    registration: {
      isRegistered: () => Promise.resolve(registered),
      register: () => {
        if (registered) return Promise.reject(new Error('Duplicate script ID'));
        registered = true;
        return Promise.resolve();
      },
      unregister: () => {
        registered = false;
        return Promise.resolve();
      },
    },
  });
  return {
    filter,
    store,
    registered: () => registered,
    setAccess: (value: boolean) => (granted = value),
  };
}

const on = { ...DEFAULT_FILTER_SETTINGS, enabled: true };

describe('media filter controller', () => {
  it('is off by default and registers nothing', async () => {
    const t = setup();
    expect(await t.filter.state()).toEqual({ settings: DEFAULT_FILTER_SETTINGS, status: 'off' });
    expect(t.registered()).toBe(false);
  });

  it('registers the content script only while on with site access', async () => {
    const t = setup();
    expect((await t.filter.update(on)).status).toBe('on');
    expect(t.registered()).toBe(true);

    // The user withdraws site access in the browser.
    t.setAccess(false);
    expect((await t.filter.reconcile()).status).toBe('needsAccess');
    expect(t.registered()).toBe(false);

    t.setAccess(true);
    // Content scripts read status without side effects; reconcile restores the registration.
    expect((await t.filter.status()).status).toBe('on');
    expect(t.registered()).toBe(false);
    await t.filter.reconcile();
    expect(t.registered()).toBe(true);

    expect((await t.filter.update({ ...on, enabled: false })).status).toBe('off');
    expect(t.registered()).toBe(false);
  });

  it('serializes overlapping changes without duplicate registrations', async () => {
    const t = setup();
    const results = await Promise.all([
      t.filter.update(on),
      t.filter.reconcile(),
      t.filter.update({ ...on, sensitivity: 'strict' }),
      t.filter.reconcile(),
    ]);
    expect(results.map((r) => r.status)).toEqual(['on', 'on', 'on', 'on']);
    expect((await t.filter.settings()).sensitivity).toBe('strict');
    expect(t.registered()).toBe(true);
  });

  it('reports unsupported browsers and never registers there', async () => {
    const t = setup({ supported: false });
    expect((await t.filter.update(on)).status).toBe('unsupported');
    expect(t.registered()).toBe(false);
  });

  it('falls back to defaults for corrupt stored settings and rejects invalid ones', async () => {
    const t = setup();
    await t.store.set('mediaFilter', { enabled: 'yes' });
    expect(await t.filter.settings()).toEqual(DEFAULT_FILTER_SETTINGS);
    await expect(
      t.filter.update({ ...on, sensitivity: 'extreme' as unknown as 'strict' }),
    ).rejects.toThrow();
  });
});
