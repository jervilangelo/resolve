/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { RuleSnapshot } from '@resolve/contracts';
import { describe, expect, it } from 'vitest';
import type { PrivateStore } from './private-store';
import {
  type DnrRule,
  type FetchRules,
  GROUP_RULE_IDS,
  STALE_AFTER_MS,
  compileRules,
  createProtection,
} from './protection';

const GROUP_A = 'grp_aaaaaaaaaaaaaaaaaaaaaaaaaa';
const GROUP_B = 'grp_bbbbbbbbbbbbbbbbbbbbbbbbbb';
type Current = Extract<RuleSnapshot, { status: 'current' }>;

function snapshot(groupId: string, ruleVersion: number, nn: string[], add: string[]): Current {
  return {
    status: 'current',
    groupId,
    ruleVersion,
    essentialVersion: 'e1',
    essential: ['youtube.com'],
    nonNegotiable: nn,
    additional: add,
  };
}

function fakeStore(): PrivateStore {
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

type Response = RuleSnapshot | 'not_found' | 'unavailable';

function setup(responses: Record<string, Response>) {
  const focusRule: DnrRule = {
    id: 100_001,
    priority: 5,
    action: { type: 'block' },
    condition: {
      requestDomains: ['youtube.com'],
      excludedRequestDomains: [],
      resourceTypes: ['main_frame'],
    },
  };
  let rules: DnrRule[] = [focusRule];
  let clock = 1_000_000;
  let active: string | null = null;
  let failWrites = false;
  const calls: { groupId: string; version?: number }[] = [];
  let beforeFetchReturns: (() => void) | null = null;
  const fetchRules: FetchRules = async (groupId, version) => {
    calls.push({ groupId, version });
    beforeFetchReturns?.();
    return Promise.resolve(responses[groupId] ?? 'not_found');
  };
  const protection = createProtection({
    dnr: {
      getRuleIds: () => Promise.resolve(rules.map((r) => r.id)),
      update: (remove, add) => {
        if (failWrites) return Promise.reject(new Error('quota'));
        rules = [...rules.filter((r) => !remove.includes(r.id)), ...add];
        return Promise.resolve();
      },
    },
    store: fakeStore(),
    fetchRules,
    activeGroup: () => Promise.resolve(active),
    now: () => clock,
  });
  return {
    protection,
    calls,
    all: () => rules,
    group: () => rules.filter((r) => r.id < 100_000),
    focusRule,
    select: (groupId: string | null) => {
      active = groupId;
    },
    advance: (ms: number) => {
      clock += ms;
    },
    respond: (groupId: string, value: Response) => {
      responses[groupId] = value;
    },
    failWrites: (value: boolean) => {
      failWrites = value;
    },
    wipeBrowserRules: () => {
      rules = rules.filter((r) => r.id >= 100_000);
    },
    onFetch: (fn: (() => void) | null) => {
      beforeFetchReturns = fn;
    },
  };
}

describe('compileRules', () => {
  it('blocks non-negotiable above additional, exempting essentials within each rule', () => {
    const rules = compileRules(
      snapshot(GROUP_A, 3, ['google.com', 'BAD', 'nn.example'], ['add.example']),
    );
    expect(rules.map((r) => [r.id, r.priority, r.action.type])).toEqual([
      [GROUP_RULE_IDS.nonNegotiable, 2, 'block'],
      [GROUP_RULE_IDS.additional, 1, 'block'],
    ]);
    // Non-canonical entries are dropped; the local essential registry is always included.
    expect(rules[0]?.condition.requestDomains).toEqual(['google.com', 'nn.example']);
    expect(rules[0]?.condition.excludedRequestDomains).toContain('mail.google.com');
    expect(rules[0]?.condition.excludedRequestDomains).toContain('youtube.com');
    expect(rules.every((r) => r.condition.resourceTypes.join() === 'main_frame,sub_frame')).toBe(
      true,
    );
  });

  it('installs nothing for an empty policy', () => {
    expect(compileRules(snapshot(GROUP_A, 1, [], []))).toEqual([]);
  });

  it('reports idle while the group blocks nothing, and on once it does', async () => {
    const t = setup({ [GROUP_A]: snapshot(GROUP_A, 1, [], []) });
    t.select(GROUP_A);
    await t.protection.sync();
    expect(await t.protection.status(GROUP_A)).toMatchObject({ state: 'idle' });
    t.respond(GROUP_A, snapshot(GROUP_A, 2, ['nn.example'], []));
    await t.protection.sync();
    expect(await t.protection.status(GROUP_A)).toMatchObject({ state: 'on' });
  });
});

describe('protection sync', () => {
  it('installs rules, keeps them offline, and reports staleness', async () => {
    const t = setup({ [GROUP_A]: snapshot(GROUP_A, 1, ['nn.example'], []) });
    t.select(GROUP_A);
    await t.protection.sync();
    expect(t.group().map((r) => r.id)).toEqual([GROUP_RULE_IDS.nonNegotiable]);
    expect(await t.protection.status(GROUP_A)).toMatchObject({ state: 'on' });

    t.respond(GROUP_A, 'unavailable');
    t.advance(STALE_AFTER_MS + 1);
    await t.protection.sync();
    expect(t.group()).toHaveLength(1);
    expect(await t.protection.status(GROUP_A)).toMatchObject({ state: 'stale' });
  });

  it('restores cached rules the browser lost, even while offline', async () => {
    const t = setup({ [GROUP_A]: snapshot(GROUP_A, 1, ['nn.example'], []) });
    t.select(GROUP_A);
    await t.protection.sync();
    t.wipeBrowserRules();
    t.respond(GROUP_A, 'unavailable');
    await t.protection.sync();
    expect(t.group().map((r) => r.id)).toEqual([GROUP_RULE_IDS.nonNegotiable]);
  });

  it('asks for changes since its version and applies new snapshots', async () => {
    const t = setup({ [GROUP_A]: snapshot(GROUP_A, 1, ['nn.example'], []) });
    t.select(GROUP_A);
    await t.protection.sync();
    t.respond(GROUP_A, snapshot(GROUP_A, 2, [], ['add.example']));
    await t.protection.sync();
    expect(t.calls.at(-1)).toEqual({ groupId: GROUP_A, version: 1 });
    expect(t.group().map((r) => r.id)).toEqual([GROUP_RULE_IDS.additional]);
  });

  it('clears on group switch and when membership ends, never touching other features', async () => {
    const t = setup({
      [GROUP_A]: snapshot(GROUP_A, 1, ['a.example'], []),
      [GROUP_B]: 'unavailable',
    });
    t.select(GROUP_A);
    await t.protection.sync();
    t.select(GROUP_B);
    await t.protection.sync();
    expect(t.group()).toEqual([]);
    expect(await t.protection.status(GROUP_B)).toEqual({ state: 'error', syncedAt: null });

    t.select(GROUP_A);
    await t.protection.sync();
    t.respond(GROUP_A, 'not_found');
    await t.protection.sync();
    expect(t.group()).toEqual([]);
    expect(t.all()).toEqual([t.focusRule]);
  });

  it('never installs a superseded group even if its response arrives late', async () => {
    const t = setup({
      [GROUP_A]: snapshot(GROUP_A, 1, ['a.example'], []),
      [GROUP_B]: snapshot(GROUP_B, 1, ['b.example'], []),
    });
    t.select(GROUP_A);
    // The user switches to B while A's rules are being fetched.
    t.onFetch(() => {
      t.select(GROUP_B);
      t.onFetch(null);
    });
    await t.protection.sync();
    // A's late response is discarded and the same run converges on B.
    expect(t.group().map((r) => r.condition.requestDomains)).toEqual([['b.example']]);
  });

  it('reports a failed first install so the user can retry', async () => {
    const t = setup({ [GROUP_A]: snapshot(GROUP_A, 1, ['a.example'], []) });
    t.select(GROUP_A);
    t.failWrites(true);
    await expect(t.protection.sync()).rejects.toThrow('quota');
    expect(await t.protection.status(GROUP_A)).toEqual({ state: 'error', syncedAt: null });
    t.failWrites(false);
    await t.protection.sync();
    expect(await t.protection.status(GROUP_A)).toMatchObject({ state: 'on' });
  });

  it('turns protection off without an active group', async () => {
    const t = setup({ [GROUP_A]: snapshot(GROUP_A, 1, ['a.example'], []) });
    t.select(GROUP_A);
    await t.protection.sync();
    t.select(null);
    await t.protection.sync();
    expect(t.group()).toEqual([]);
    expect(await t.protection.status(null)).toEqual({ state: 'off', syncedAt: null });
  });
});

describe('review regressions', () => {
  it('clears rules when the session ends during a rules fetch', async () => {
    const t = setup({ [GROUP_A]: snapshot(GROUP_A, 1, ['a.example'], []) });
    t.select(GROUP_A);
    await t.protection.sync();
    t.respond(GROUP_A, snapshot(GROUP_A, 2, ['a.example'], []));
    // A 401 during the fetch ends the session (no active group afterwards).
    t.onFetch(() => {
      t.select(null);
      t.onFetch(null);
    });
    await t.protection.sync();
    expect(t.group()).toEqual([]);
  });
});

describe('blockedBy', () => {
  it('names the installed group rule covering a host, exempting essentials', async () => {
    const t = setup({
      [GROUP_A]: snapshot(GROUP_A, 1, ['google.com', 'nn.example'], ['add.example']),
    });
    t.select(GROUP_A);
    await t.protection.sync();
    const before = JSON.stringify(t.all());
    expect(await t.protection.blockedBy('www.nn.example')).toBe('nonNegotiable');
    expect(await t.protection.blockedBy('add.example')).toBe('additional');
    expect(await t.protection.blockedBy('mail.google.com')).toBeNull();
    expect(await t.protection.blockedBy('other.example')).toBeNull();
    expect(JSON.stringify(t.all())).toBe(before);
    // Signed out (or no group): nothing installed, nothing matched.
    t.select(null);
    await t.protection.sync();
    expect(await t.protection.blockedBy('nn.example')).toBeNull();
  });
});
