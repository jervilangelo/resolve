/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { RuleSnapshot } from '@resolve/contracts';
import { ESSENTIAL_DOMAINS, coveredBy, normalizeDomain } from '@resolve/domain-policy';
import { z } from 'zod';
import type { PrivateStore } from './private-store';

/**
 * Group domain protection with Chromium declarativeNetRequest (docs/MASTER_PLAN.md §4.3, §4.4).
 *
 * Two dynamic rules carry the whole policy: a non-negotiable and an additional block rule, each
 * listing its domains in requestDomains (which covers subdomains) and the essential services in
 * excludedRequestDomains. Exemptions are scoped to these group rules rather than being a global
 * allow rule, so other features (e.g. a future Focus Mode, which may restrict essential sites)
 * keep full control of their own rules. Only page and frame navigations are affected, never
 * subresources, so essential services keep the third-party hosts they depend on.
 *
 * Rule IDs 1–99999 are reserved for group policy; nothing here touches rules outside this range.
 */
export const GROUP_RULE_IDS = { nonNegotiable: 2, additional: 3 } as const;
const GROUP_RULE_RANGE_MAX = 99_999;
const PRIORITY = { nonNegotiable: 2, additional: 1 } as const;
const RESOURCE_TYPES = ['main_frame', 'sub_frame'] as const;

/** Synced rules older than this are reported as stale (they keep being enforced). */
export const STALE_AFTER_MS = 60 * 60 * 1000;

export interface DnrRule {
  id: number;
  priority: number;
  action: { type: 'block' };
  condition: {
    requestDomains: string[];
    excludedRequestDomains: string[];
    resourceTypes: (typeof RESOURCE_TYPES)[number][];
  };
}

/** The declarativeNetRequest calls used, so the controller can be unit tested. */
export interface DnrAdapter {
  getRuleIds(): Promise<number[]>;
  update(removeRuleIds: number[], addRules: DnrRule[]): Promise<void>;
}

const META_KEY = 'protection';
const FAILURE_KEY = 'protectionFailure';

const ruleSchema = z.object({
  id: z.number(),
  priority: z.number(),
  action: z.object({ type: z.literal('block') }),
  condition: z.object({
    requestDomains: z.array(z.string()),
    excludedRequestDomains: z.array(z.string()),
    resourceTypes: z.array(z.enum(RESOURCE_TYPES)),
  }),
});

/** The installed snapshot, including its compiled rules so they can be restored offline. */
const metaSchema = z.object({
  groupId: z.string(),
  ruleVersion: z.number(),
  essentialVersion: z.string(),
  syncedAt: z.number(),
  rules: z.array(ruleSchema),
});
type Meta = z.infer<typeof metaSchema>;

/** Keeps only well-formed, canonical domains from a snapshot (defence in depth). */
function canonical(domains: readonly string[]): string[] {
  return [
    ...new Set(
      domains.filter((d) => {
        const result = normalizeDomain(d);
        return result.ok && result.domain === d;
      }),
    ),
  ].sort();
}

export function compileRules(snapshot: Extract<RuleSnapshot, { status: 'current' }>): DnrRule[] {
  // The local registry always applies too, so a server-side omission can never block an
  // essential service.
  const essential = canonical([...snapshot.essential, ...ESSENTIAL_DOMAINS.map((e) => e.domain)]);
  const rule = (id: number, priority: number, requestDomains: string[]): DnrRule[] =>
    requestDomains.length === 0
      ? []
      : [
          {
            id,
            priority,
            action: { type: 'block' },
            condition: {
              requestDomains,
              excludedRequestDomains: essential,
              resourceTypes: [...RESOURCE_TYPES],
            },
          },
        ];
  return [
    ...rule(
      GROUP_RULE_IDS.nonNegotiable,
      PRIORITY.nonNegotiable,
      canonical(snapshot.nonNegotiable),
    ),
    ...rule(GROUP_RULE_IDS.additional, PRIORITY.additional, canonical(snapshot.additional)),
  ];
}

export type FetchRules = (
  groupId: string,
  version?: number,
  essentialVersion?: string,
) => Promise<RuleSnapshot | 'not_found' | 'unavailable'>;

export interface ProtectionStatus {
  /**
   * off: no active group; starting: first install pending; error: install failed; idle: synced,
   * but the group blocks no websites yet (protection starts by itself once it does).
   */
  state: 'off' | 'starting' | 'idle' | 'on' | 'stale' | 'error';
  syncedAt: number | null;
}

export function createProtection(deps: {
  dnr: DnrAdapter;
  store: PrivateStore;
  fetchRules: FetchRules;
  /** The active group of the current sign-in, read fresh at the time a sync runs. */
  activeGroup(): Promise<string | null>;
  now(): number;
}) {
  const { dnr, store } = deps;
  let queue: Promise<void> = Promise.resolve();

  async function groupRuleIds(): Promise<number[]> {
    return (await dnr.getRuleIds()).filter((id) => id >= 1 && id <= GROUP_RULE_RANGE_MAX);
  }

  async function install(rules: DnrRule[]): Promise<void> {
    await dnr.update(await groupRuleIds(), rules);
  }

  async function readMeta(): Promise<Meta | null> {
    const result = metaSchema.safeParse(await store.get(META_KEY));
    return result.success ? result.data : null;
  }

  async function clear(): Promise<void> {
    await install([]);
    await store.remove(META_KEY);
  }

  /** Brings installed rules in line with the current active group (whatever the trigger was). */
  async function reconcile(): Promise<void> {
    const groupId = await deps.activeGroup();
    if (!groupId) {
      await clear();
      await store.remove(FAILURE_KEY);
      return;
    }
    let meta = await readMeta();
    if (meta && meta.groupId !== groupId) {
      // Switching groups: never enforce the previous group's rules for the new one.
      await clear();
      meta = null;
    }
    if (meta) {
      // Repair: if the browser lost our rules (interrupted write, profile reset), reinstall the
      // cached snapshot before anything else, so protection holds even offline.
      const installed = (await groupRuleIds()).sort().join();
      const expected = meta.rules
        .map((r) => r.id)
        .sort()
        .join();
      if (installed !== expected) await install(meta.rules);
    }

    const result = await deps.fetchRules(groupId, meta?.ruleVersion, meta?.essentialVersion);
    // The active group changed while the request was in flight (switch, sign-out, or a 401 that
    // ended the session): start over against the current state, which may mean clearing.
    if ((await deps.activeGroup()) !== groupId) {
      await reconcile();
      return;
    }
    if (result === 'not_found') {
      await clear();
      return;
    }
    if (result === 'unavailable' || result.groupId !== groupId) {
      if (!meta) await store.set(FAILURE_KEY, { groupId, at: deps.now() });
      return;
    }
    if (result.status === 'unchanged') {
      if (meta) await store.set(META_KEY, { ...meta, syncedAt: deps.now() } satisfies Meta);
      return;
    }
    const rules = compileRules(result);
    await install(rules);
    await store.set(META_KEY, {
      groupId,
      ruleVersion: result.ruleVersion,
      essentialVersion: result.essentialVersion,
      syncedAt: deps.now(),
      rules,
    } satisfies Meta);
    await store.remove(FAILURE_KEY);
  }

  return {
    /**
     * Reconciles group rules with the current active group. Calls are serialized and each one
     * re-reads the active group, so a late or superseded trigger can never install stale rules.
     */
    async sync(): Promise<void> {
      const run = queue
        .catch(() => undefined)
        .then(async () => {
          try {
            await reconcile();
          } catch (error) {
            const groupId = await deps.activeGroup().catch(() => null);
            if (groupId && !(await readMeta())) {
              await store.set(FAILURE_KEY, { groupId, at: deps.now() });
            }
            throw error;
          }
        });
      queue = run;
      await run;
    },

    /**
     * Which installed group rule blocks `host` (read-only, from the local snapshot of the rules
     * actually installed, so it works offline and during a group switch); null when no group rule
     * blocks it or it is exempt as essential.
     */
    async blockedBy(host: string): Promise<'nonNegotiable' | 'additional' | null> {
      const meta = await readMeta();
      if (!meta) return null;
      for (const [kind, id] of [
        ['nonNegotiable', GROUP_RULE_IDS.nonNegotiable],
        ['additional', GROUP_RULE_IDS.additional],
      ] as const) {
        const rule = meta.rules.find((r) => r.id === id);
        if (!rule) continue;
        if (rule.condition.excludedRequestDomains.some((d) => coveredBy(host, d))) continue;
        if (rule.condition.requestDomains.some((d) => coveredBy(host, d))) return kind;
      }
      return null;
    },

    /**
     * The non-negotiable rule installed for `activeGroupId` (for Trigger A reporting), or null when
     * that group's rules are not installed or it blocks nothing non-negotiable.
     */
    async nonNegotiableRule(activeGroupId: string | null) {
      const meta = await readMeta();
      if (!activeGroupId || meta?.groupId !== activeGroupId) return null;
      const rule = meta.rules.find((r) => r.id === GROUP_RULE_IDS.nonNegotiable);
      if (!rule) return null;
      return {
        groupId: meta.groupId,
        ruleVersion: meta.ruleVersion,
        domains: rule.condition.requestDomains,
        exempt: rule.condition.excludedRequestDomains,
      };
    },

    async status(activeGroupId: string | null): Promise<ProtectionStatus> {
      if (!activeGroupId) return { state: 'off', syncedAt: null };
      const meta = await readMeta();
      if (meta?.groupId !== activeGroupId) {
        const failure = z.object({ groupId: z.string() }).safeParse(await store.get(FAILURE_KEY));
        const failed = failure.success && failure.data.groupId === activeGroupId;
        return { state: failed ? 'error' : 'starting', syncedAt: null };
      }
      const stale = deps.now() - meta.syncedAt > STALE_AFTER_MS;
      if (stale) return { state: 'stale', syncedAt: meta.syncedAt };
      return { state: meta.rules.length === 0 ? 'idle' : 'on', syncedAt: meta.syncedAt };
    },
  };
}

export type Protection = ReturnType<typeof createProtection>;
