/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_FOCUS, FOCUS_RULE_ID, type FocusRule, createFocus, focusDomains } from './focus';
import type { PrivateStore } from './private-store';

const GROUP_RULES = [
  { id: 2, action: { type: 'block' }, condition: { requestDomains: ['casino.example'] } },
  { id: 3, action: { type: 'block' }, condition: { requestDomains: ['news.example'] } },
];

function fakes({ access = true, failUpdates = false } = {}) {
  const data = new Map<string, unknown>();
  const store: PrivateStore = {
    get: (k) => Promise.resolve(data.get(k)),
    set: (k, v) => {
      data.set(k, v);
      return Promise.resolve();
    },
    remove: (k) => {
      data.delete(k);
      return Promise.resolve();
    },
    update: (k, change) => {
      const next = change(data.get(k));
      if (next === undefined) data.delete(k);
      else data.set(k, next);
      return Promise.resolve(next);
    },
  };
  let rules: {
    id: number;
    action: { type: string; redirect?: { extensionPath?: string } };
    condition: { requestDomains?: string[]; excludedRequestDomains?: string[] };
    rule?: FocusRule;
  }[] = [...GROUP_RULES];
  const state = { failUpdates, access, updates: 0 };
  const dnr = {
    getRules: () =>
      Promise.resolve(rules.map((r) => ({ id: r.id, action: r.action, condition: r.condition }))),
    update: (remove: number[], add: FocusRule[]) => {
      state.updates += 1;
      if (state.failUpdates) return Promise.reject(new Error('quota'));
      rules = [
        ...rules.filter((r) => !remove.includes(r.id)),
        ...add.map((r) => ({ id: r.id, action: r.action, condition: r.condition, rule: r })),
      ];
      return Promise.resolve();
    },
  };
  const focusRule = () => rules.find((r) => r.id === FOCUS_RULE_ID)?.rule;
  const make = () =>
    createFocus({ dnr, store, hasSiteAccess: () => Promise.resolve(state.access) });
  return { make, focusRule, rules: () => rules, state, data };
}

const ON = { ...DEFAULT_FOCUS, enabled: true };

describe('Focus Mode', () => {
  it('is off by default and installs nothing', async () => {
    const f = fakes();
    const state = await f.make().state();
    expect(state.settings).toEqual(DEFAULT_FOCUS);
    expect(state.enforcement).toBe('off');
    expect(f.focusRule()).toBeUndefined();
  });

  it('blocks the five mandatory services, with their alternate domains, when on', async () => {
    const f = fakes();
    const state = await f.make().update(ON);
    expect(state.enforcement).toBe('on');
    const domains = f.focusRule()?.condition.requestDomains ?? [];
    for (const d of [
      'facebook.com',
      'instagram.com',
      'x.com',
      'twitter.com',
      'tiktok.com',
      'reddit.com',
    ]) {
      expect(domains).toContain(d);
    }
    for (const d of ['youtube.com', 'netflix.com', 'twitch.tv', 'messenger.com', 't.co']) {
      expect(domains).not.toContain(d);
    }
    expect(f.focusRule()?.condition.resourceTypes).toEqual(['main_frame']);
  });

  it('adds and removes optional services immediately while on', async () => {
    const f = fakes();
    const focus = f.make();
    await focus.update(ON);
    await focus.update({ ...ON, optional: { youtube: true, netflix: false, twitch: true } });
    let domains = f.focusRule()?.condition.requestDomains ?? [];
    expect(domains).toEqual(expect.arrayContaining(['youtube.com', 'youtu.be', 'twitch.tv']));
    expect(domains).not.toContain('netflix.com');
    // Google sign-in passes through accounts.youtube.com; it is never blocked.
    expect(f.focusRule()?.condition.excludedRequestDomains).toEqual(['accounts.youtube.com']);
    await focus.update({ ...ON, optional: { youtube: false, netflix: false, twitch: true } });
    domains = f.focusRule()?.condition.requestDomains ?? [];
    expect(domains).not.toContain('youtube.com');
  });

  it('turning off removes only the Focus rule; group rules stay exactly as they were', async () => {
    const f = fakes();
    const focus = f.make();
    await focus.update({ ...ON, optional: { youtube: true, netflix: true, twitch: true } });
    expect(f.rules().filter((r) => r.id < 100_000)).toEqual(GROUP_RULES);
    const state = await focus.update({ ...DEFAULT_FOCUS });
    expect(state.enforcement).toBe('off');
    expect(f.rules()).toEqual(GROUP_RULES);
  });

  it('blocks group-exempt services such as Facebook and YouTube (no essential exclusions)', async () => {
    const f = fakes();
    await f.make().update({ ...ON, optional: { youtube: true, netflix: false, twitch: false } });
    const rule = f.focusRule();
    expect(rule?.condition.requestDomains).toEqual(
      expect.arrayContaining(['facebook.com', 'youtube.com']),
    );
    expect(rule?.condition.excludedRequestDomains).not.toContain('facebook.com');
    // Priority 1: a group block on the same site always wins, so group alerts are unchanged.
    expect(rule?.priority).toBe(1);
  });

  it('shows the Focus page with site access, and falls back to a plain block without it', async () => {
    const withAccess = fakes({ access: true });
    await withAccess.make().update(ON);
    expect(withAccess.focusRule()?.action).toEqual({
      type: 'redirect',
      redirect: { extensionPath: '/focus.html' },
    });
    const without = fakes({ access: false });
    await without.make().update(ON);
    expect(without.focusRule()?.action).toEqual({ type: 'block' });
  });

  it('reports an error when a Focus page redirect is left without site access', async () => {
    const f = fakes({ access: true });
    const focus = f.make();
    await focus.update(ON);
    f.state.access = false;
    expect((await focus.state()).enforcement).toBe('error');
    await focus.reconcile();
    expect(f.focusRule()?.action).toEqual({ type: 'block' });
    expect((await focus.state()).enforcement).toBe('on');
  });

  it('restores its rules after a browser restart from local settings', async () => {
    const f = fakes();
    await f.make().update(ON);
    // A restart: the browser kept no dynamic rules, the settings survived in the local store.
    f.rules().splice(0, f.rules().length, ...GROUP_RULES);
    const restarted = f.make();
    await restarted.reconcile();
    expect((await restarted.state()).enforcement).toBe('on');
    expect(f.focusRule()?.condition.requestDomains).toContain('x.com');
    expect([...f.data.keys()]).toEqual(['focus']);
  });

  it('reports a failed update as an error instead of claiming it is on', async () => {
    const f = fakes({ failUpdates: true });
    const state = await f.make().update(ON);
    expect(state.settings.enabled).toBe(true);
    expect(state.enforcement).toBe('error');
    expect(f.rules()).toEqual(GROUP_RULES);
  });

  it('ends in the last requested state when toggled rapidly', async () => {
    const f = fakes();
    const focus = f.make();
    const results = await Promise.all([
      focus.update(ON),
      focus.update(DEFAULT_FOCUS),
      focus.update(ON),
      focus.update(DEFAULT_FOCUS),
    ]);
    expect(results.at(-1)?.enforcement).toBe('off');
    expect(f.rules()).toEqual(GROUP_RULES);
  });

  it('keeps the mandatory list fixed regardless of optional choices', () => {
    const off = focusDomains({
      ...ON,
      optional: { youtube: false, netflix: false, twitch: false },
    });
    const all = focusDomains({ ...ON, optional: { youtube: true, netflix: true, twitch: true } });
    expect(all.domains).toEqual(expect.arrayContaining(off.domains));
  });
});
