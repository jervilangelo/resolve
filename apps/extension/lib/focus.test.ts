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
const NONE = { youtube: false, netflix: false, twitch: false };
const ALL = { youtube: true, netflix: true, twitch: true };
const MIN = 60_000;

function fakes({ access = true, failUpdates = false, failAlarms = false } = {}) {
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
  const state = {
    failUpdates,
    failAlarms,
    access,
    clock: 1_000_000_000_000,
    alarm: null as number | null,
  };
  const dnr = {
    getRules: () =>
      Promise.resolve(rules.map((r) => ({ id: r.id, action: r.action, condition: r.condition }))),
    update: (remove: number[], add: FocusRule[]) => {
      if (state.failUpdates) return Promise.reject(new Error('quota'));
      rules = [
        ...rules.filter((r) => !remove.includes(r.id)),
        ...add.map((r) => ({ id: r.id, action: r.action, condition: r.condition, rule: r })),
      ];
      return Promise.resolve();
    },
  };
  const make = () =>
    createFocus({
      dnr,
      store,
      hasSiteAccess: () => Promise.resolve(state.access),
      now: () => state.clock,
      scheduleEnd: (at) => {
        if (state.failAlarms) return Promise.reject(new Error('alarms unavailable'));
        state.alarm = at;
        return Promise.resolve();
      },
    });
  return {
    make,
    state,
    data,
    rules: () => rules,
    focusRule: () => rules.find((r) => r.id === FOCUS_RULE_ID)?.rule,
    advance: (ms: number) => (state.clock += ms),
  };
}

describe('Focus Mode sessions', () => {
  it('is off by default, offers 25 minutes and installs nothing', async () => {
    const f = fakes();
    const state = await f.make().state();
    expect(state.session).toBeNull();
    expect(state.settings).toEqual(DEFAULT_FOCUS);
    expect(state.enforcement).toBe('off');
    expect(f.focusRule()).toBeUndefined();
  });

  it('starts a 25-minute session: blocks the five sites, sets the deadline and the alarm', async () => {
    const f = fakes();
    const start = f.state.clock;
    const state = await f.make().start(25, NONE);
    expect(state.session).toEqual({ startedAt: start, endsAt: start + 25 * MIN, minutes: 25 });
    expect(state.enforcement).toBe('on');
    expect(f.state.alarm).toBe(start + 25 * MIN);
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
    for (const d of ['youtube.com', 'netflix.com', 'twitch.tv', 'messenger.com']) {
      expect(domains).not.toContain(d);
    }
    expect(f.focusRule()?.priority).toBe(1);
  });

  it('includes the optional sites chosen at start', async () => {
    const f = fakes();
    await f.make().start(15, { youtube: true, netflix: false, twitch: true });
    const domains = f.focusRule()?.condition.requestDomains ?? [];
    expect(domains).toEqual(expect.arrayContaining(['youtube.com', 'youtu.be', 'twitch.tv']));
    expect(domains).not.toContain('netflix.com');
    expect(f.focusRule()?.condition.excludedRequestDomains).toEqual(['accounts.youtube.com']);
  });

  it('rejects durations outside 5–240 whole minutes', async () => {
    const focus = fakes().make();
    await expect(focus.start(4, NONE)).rejects.toThrow();
    await expect(focus.start(241, NONE)).rejects.toThrow();
    await expect(focus.start(12.5, NONE)).rejects.toThrow();
  });

  it('never starts a second session or changes settings while one runs', async () => {
    const f = fakes();
    const focus = f.make();
    const results = await Promise.all([
      focus.start(25, NONE),
      focus.start(60, ALL),
      focus.configure(ALL, 45),
    ]);
    const endsAt = results[0].session?.endsAt;
    expect(results.map((r) => r.session?.endsAt)).toEqual([endsAt, endsAt, endsAt]);
    expect(results[2].settings.minutes).toBe(25);
    expect(f.focusRule()?.condition.requestDomains).not.toContain('youtube.com');
  });

  it('expires at the deadline, removing only its own rule', async () => {
    const f = fakes();
    const focus = f.make();
    await focus.start(25, NONE);
    f.advance(25 * MIN - 1000);
    expect((await focus.state()).session).not.toBeNull();
    f.advance(1000);
    await focus.reconcile();
    const state = await focus.state();
    expect(state.session).toBeNull();
    expect(state.enforcement).toBe('off');
    expect(f.rules()).toEqual(GROUP_RULES);
    expect(f.state.alarm).toBeNull();
  });

  it('expires on the next look after the computer slept past the deadline', async () => {
    const f = fakes();
    const focus = f.make();
    await focus.start(30, NONE);
    f.advance(3 * 60 * MIN);
    expect((await focus.state()).session).toBeNull();
    expect(f.rules()).toEqual(GROUP_RULES);
  });

  it('restores a running session after a restart with its original deadline', async () => {
    const f = fakes();
    const first = await f.make().start(45, NONE);
    f.advance(10 * MIN);
    f.rules().splice(0, f.rules().length, ...GROUP_RULES);
    f.state.alarm = null;
    const restarted = f.make();
    await restarted.reconcile();
    const state = await restarted.state();
    expect(state.session?.endsAt).toBe(first.session?.endsAt);
    expect(state.enforcement).toBe('on');
    expect(f.state.alarm).toBe(first.session?.endsAt);
    expect([...f.data.keys()]).toEqual(['focus']);
  });

  it('lifts Focus when the browser restarts after the deadline', async () => {
    const f = fakes();
    await f.make().start(15, NONE);
    f.advance(20 * MIN);
    const restarted = f.make();
    await restarted.reconcile();
    expect(f.rules()).toEqual(GROUP_RULES);
    expect((await restarted.state()).session).toBeNull();
  });

  it('ends early on request, removing only its own rule, and keeps the choices', async () => {
    const f = fakes();
    const focus = f.make();
    await focus.start(60, ALL);
    const ended = await focus.end();
    expect(ended.session).toBeNull();
    expect(ended.enforcement).toBe('off');
    expect(f.rules()).toEqual(GROUP_RULES);
    expect(f.state.alarm).toBeNull();
    expect((await focus.end()).session).toBeNull();
    expect(ended.settings.optional).toEqual(ALL);
  });

  it('still expires on time when alarms fail', async () => {
    const f = fakes({ failAlarms: true });
    const focus = f.make();
    expect((await focus.start(25, NONE)).enforcement).toBe('on');
    f.advance(26 * MIN);
    expect((await focus.state()).session).toBeNull();
    expect(f.rules()).toEqual(GROUP_RULES);
  });

  it('reports a failed rule update as an error, never as on', async () => {
    const f = fakes({ failUpdates: true });
    const state = await f.make().start(25, NONE);
    expect(state.session).not.toBeNull();
    expect(state.enforcement).toBe('error');
    expect(f.rules()).toEqual(GROUP_RULES);
  });

  it('shows the Focus page with site access and a plain block without it', async () => {
    const withAccess = fakes({ access: true });
    await withAccess.make().start(25, NONE);
    expect(withAccess.focusRule()?.action).toEqual({
      type: 'redirect',
      redirect: { extensionPath: '/focus.html' },
    });
    const without = fakes({ access: false });
    await without.make().start(25, NONE);
    expect(without.focusRule()?.action).toEqual({ type: 'block' });
  });

  it('reports an error when a redirect is left without site access, until reconciled', async () => {
    const f = fakes({ access: true });
    const focus = f.make();
    await focus.start(25, NONE);
    f.state.access = false;
    expect((await focus.state()).enforcement).toBe('error');
    await focus.reconcile();
    expect(f.focusRule()?.action).toEqual({ type: 'block' });
    expect((await focus.state()).enforcement).toBe('on');
  });

  it('turns an active 0.2.0 switch into a 60-minute session on upgrade', async () => {
    const f = fakes();
    f.data.set('focus', {
      enabled: true,
      optional: { youtube: true, netflix: false, twitch: false },
    });
    const focus = f.make();
    await focus.reconcile();
    const state = await focus.state();
    expect(state.session?.minutes).toBe(60);
    expect(state.enforcement).toBe('on');
    expect(f.focusRule()?.condition.requestDomains).toContain('youtube.com');
    // The migrated deadline is saved once: it does not move with later reads, and it expires.
    const endsAt = state.session?.endsAt;
    f.advance(30 * MIN);
    expect((await focus.state()).session?.endsAt).toBe(endsAt);
    f.advance(31 * MIN);
    expect((await focus.state()).session).toBeNull();
    expect(f.rules()).toEqual(GROUP_RULES);
  });

  it('keeps the mandatory list fixed regardless of optional choices', () => {
    const none = focusDomains({ optional: NONE });
    const all = focusDomains({ optional: ALL });
    expect(all.domains).toEqual(expect.arrayContaining(none.domains));
  });
});

describe('covers', () => {
  it('matches only the running session’s sites, never the exceptions', async () => {
    const f = fakes();
    const focus = f.make();
    expect(await focus.covers('www.facebook.com')).toBe(false);
    await focus.start(25, { youtube: true, netflix: false, twitch: false });
    expect(await focus.covers('www.facebook.com')).toBe(true);
    expect(await focus.covers('m.youtube.com')).toBe(true);
    expect(await focus.covers('accounts.youtube.com')).toBe(false);
    expect(await focus.covers('netflix.com')).toBe(false);
    expect(await focus.covers('casino.example')).toBe(false);
    f.advance(26 * MIN);
    expect(await focus.covers('www.facebook.com')).toBe(false);
  });
});
