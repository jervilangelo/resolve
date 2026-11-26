/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';
import type { PrivateStore } from './private-store';

/**
 * Focus Mode: a voluntary, local-only block of distracting websites, separate from group policy.
 *
 * Isolation from group protection (lib/protection.ts):
 * - Focus owns dynamic rule IDs 100000–100999; group code only touches 1–99999, and this code only
 *   touches its own range, so turning Focus off can never remove a group rule.
 * - Focus rules have priority 1. A group block (priority 1 or 2) always wins over a Focus redirect
 *   for the same request (at equal priority, block beats redirect), so a group-restricted visit
 *   is still a plain block and Trigger A reporting is unchanged. Focus never adds allow rules.
 * - Group essential-service exemptions are scoped to group rules, so Focus may block e.g. YouTube.
 * Only top-level navigations are affected, so embeds and sign-in flows elsewhere keep working.
 */

export const FOCUS_RULE_ID = 100_001;
const FOCUS_RANGE = { min: 100_000, max: 100_999 } as const;
const FOCUS_PRIORITY = 1;
export const FOCUS_PAGE = '/focus.html';

export const MANDATORY_SERVICES = ['facebook', 'instagram', 'x', 'tiktok', 'reddit'] as const;
export const OPTIONAL_SERVICES = ['youtube', 'netflix', 'twitch'] as const;
type Service = (typeof MANDATORY_SERVICES)[number] | (typeof OPTIONAL_SERVICES)[number];
export type OptionalService = (typeof OPTIONAL_SERVICES)[number];

/** Each service's own domains (subdomains are covered by requestDomains). */
export const SERVICES: Record<Service, { name: string; domains: string[]; except?: string[] }> = {
  facebook: { name: 'Facebook', domains: ['facebook.com', 'fb.com', 'fb.watch'] },
  instagram: { name: 'Instagram', domains: ['instagram.com', 'instagr.am'] },
  x: { name: 'X (Twitter)', domains: ['x.com', 'twitter.com'] },
  tiktok: { name: 'TikTok', domains: ['tiktok.com'] },
  reddit: { name: 'Reddit', domains: ['reddit.com', 'redd.it'] },
  // accounts.youtube.com is part of Google sign-in, so it stays reachable.
  youtube: {
    name: 'YouTube',
    domains: ['youtube.com', 'youtu.be'],
    except: ['accounts.youtube.com'],
  },
  netflix: { name: 'Netflix', domains: ['netflix.com'] },
  twitch: { name: 'Twitch', domains: ['twitch.tv'] },
};

/** Session length limits, in minutes. */
export const FOCUS_MINUTES = { min: 5, max: 240, presets: [15, 25, 30, 45, 60] } as const;

const optionalSchema = z.strictObject({
  youtube: z.boolean(),
  netflix: z.boolean(),
  twitch: z.boolean(),
});
export type FocusOptional = z.infer<typeof optionalSchema>;

export const focusMinutesSchema = z.number().int().min(FOCUS_MINUTES.min).max(FOCUS_MINUTES.max);

/** A timed session: its deadline is the single source of truth for whether Focus is on. */
export const focusSessionSchema = z.strictObject({
  startedAt: z.number(),
  endsAt: z.number(),
  minutes: focusMinutesSchema,
});
export type FocusSession = z.infer<typeof focusSessionSchema>;

export const focusSettingsSchema = z.strictObject({
  optional: optionalSchema,
  /** The last chosen duration, offered again next time. */
  minutes: focusMinutesSchema,
  session: focusSessionSchema.nullable(),
});
export type FocusSettings = z.infer<typeof focusSettingsSchema>;

export const DEFAULT_FOCUS: FocusSettings = {
  optional: { youtube: false, netflix: false, twitch: false },
  minutes: 25,
  session: null,
};

/** Settings saved by 0.2.0 (an untimed switch). An active one becomes a 60-minute session. */
const legacySchema = z.object({ enabled: z.boolean(), optional: optionalSchema });

/** True while the session's deadline has not passed. */
export function isActive(settings: FocusSettings, now: number): boolean {
  return settings.session !== null && now < settings.session.endsAt;
}

/**
 * What the browser is actually enforcing: `on` (rules installed as configured), `off`, or
 * `error` (the last update failed; the browser's rules are reported, not the intent).
 */
export type FocusEnforcement = 'on' | 'off' | 'error';

export interface FocusState {
  settings: FocusSettings;
  /** The running session, or null (an expired one is never reported as running). */
  session: FocusSession | null;
  enforcement: FocusEnforcement;
  /** Blocked visits show Resolve's Focus page (needs site access); otherwise the browser's page. */
  focusPage: boolean;
  supported: boolean;
}

export interface FocusRule {
  id: number;
  priority: number;
  action: { type: 'block' } | { type: 'redirect'; redirect: { extensionPath: string } };
  condition: {
    requestDomains: string[];
    excludedRequestDomains?: string[];
    resourceTypes: ['main_frame'];
  };
}

interface InstalledRule {
  id: number;
  action: { type: string; redirect?: { extensionPath?: string } };
  condition: { requestDomains?: string[]; excludedRequestDomains?: string[] };
}

export interface FocusDnr {
  getRules(): Promise<InstalledRule[]>;
  update(removeRuleIds: number[], addRules: FocusRule[]): Promise<void>;
}

export interface FocusDeps {
  dnr: FocusDnr | null;
  store: PrivateStore;
  /** Whether redirects to the Focus page are possible (host access to the Focus domains). */
  hasSiteAccess(): Promise<boolean>;
  /** Sends already-open tabs on blocked sites (not `except` hosts) to the Focus page. */
  closeOpenTabs?(patterns: string[], except: string[]): Promise<void>;
  now(): number;
  /** Wakes the background at the deadline (null clears it); a missed wake is caught by reconcile. */
  scheduleEnd(at: number | null): Promise<void>;
  /** Tells open extension pages that Focus changed (e.g. it expired), so they refresh. */
  notify?(): void;
}

const KEY = 'focus';

/** The domains blocked for the given settings, sorted and unique. */
export function focusDomains(settings: { optional: FocusOptional }): {
  domains: string[];
  except: string[];
} {
  const services: Service[] = [
    ...MANDATORY_SERVICES,
    ...OPTIONAL_SERVICES.filter((s) => settings.optional[s]),
  ];
  const domains = new Set<string>();
  const except = new Set<string>();
  for (const s of services) {
    SERVICES[s].domains.forEach((d) => domains.add(d));
    SERVICES[s].except?.forEach((d) => except.add(d));
  }
  return { domains: [...domains].sort(), except: [...except].sort() };
}

/** URL match patterns for the given domains (tabs.query, permission requests). */
export function matchPatterns(domains: readonly string[]): string[] {
  return domains.flatMap((d) => [`*://${d}/*`, `*://*.${d}/*`]);
}

/** Every domain Focus could ever block: what site access is requested for. */
export const ALL_FOCUS_PATTERNS = matchPatterns(Object.values(SERVICES).flatMap((s) => s.domains));

export function compileFocusRules(
  settings: FocusSettings,
  focusPage: boolean,
  now: number,
): FocusRule[] {
  if (!isActive(settings, now)) return [];
  const { domains, except } = focusDomains(settings);
  return [
    {
      id: FOCUS_RULE_ID,
      priority: FOCUS_PRIORITY,
      action: focusPage
        ? { type: 'redirect', redirect: { extensionPath: FOCUS_PAGE } }
        : { type: 'block' },
      condition: {
        requestDomains: domains,
        ...(except.length > 0 && { excludedRequestDomains: except }),
        resourceTypes: ['main_frame'],
      },
    },
  ];
}

const inRange = (id: number) => id >= FOCUS_RANGE.min && id <= FOCUS_RANGE.max;

export function createFocus(deps: FocusDeps) {
  let queue: Promise<unknown> = Promise.resolve();

  /** Runs changes one at a time, so repeated clicks and timers never interleave. */
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  }

  async function settings(): Promise<FocusSettings> {
    const raw = await deps.store.get(KEY);
    const parsed = focusSettingsSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    const legacy = legacySchema.safeParse(raw);
    if (!legacy.success) return DEFAULT_FOCUS;
    const now = deps.now();
    const migrated: FocusSettings = {
      optional: legacy.data.optional,
      minutes: 60,
      session: legacy.data.enabled
        ? { startedAt: now, endsAt: now + 60 * 60_000, minutes: 60 }
        : null,
    };
    // Saved once, so the deadline is fixed rather than moving with every read.
    await deps.store.set(KEY, migrated);
    return migrated;
  }

  async function enforcement(
    wanted: FocusSettings,
    focusPage: boolean,
    now: number,
  ): Promise<FocusEnforcement> {
    if (!deps.dnr) return 'off';
    const installed = (await deps.dnr.getRules()).filter((r) => inRange(r.id));
    const expected = compileFocusRules(wanted, focusPage, now);
    if (expected.length === 0) return installed.length === 0 ? 'off' : 'error';
    const shape = (r: InstalledRule | FocusRule) =>
      JSON.stringify({
        action: r.action.type,
        path: r.action.type === 'redirect' ? r.action.redirect?.extensionPath : undefined,
        domains: [...(r.condition.requestDomains ?? [])].sort(),
        except: [...(r.condition.excludedRequestDomains ?? [])].sort(),
      });
    // A redirect without site access would let the sites load, so the action must match too.
    return installed.length === expected.length &&
      installed.every((r, i) => expected[i] !== undefined && shape(r) === shape(expected[i]))
      ? 'on'
      : 'error';
  }

  /** Brings the browser's Focus rules and the end-of-session alarm in line with the settings. */
  async function apply(wanted: FocusSettings): Promise<void> {
    const now = deps.now();
    const endsAt = isActive(wanted, now) ? (wanted.session?.endsAt ?? null) : null;
    await deps.scheduleEnd(endsAt).catch(() => undefined);
    if (!deps.dnr) {
      deps.notify?.();
      return;
    }
    const focusPage = await deps.hasSiteAccess().catch(() => false);
    const existing = (await deps.dnr.getRules()).map((r) => r.id).filter(inRange);
    // A failure leaves the previous rules in place; state() then reports the mismatch.
    await deps.dnr
      .update(existing, compileFocusRules(wanted, focusPage, now))
      .catch(() => undefined);
    deps.notify?.();
  }

  /** The stored settings, with a session whose deadline passed cleared (idempotent expiry). */
  async function current(now = deps.now()): Promise<FocusSettings> {
    const stored = await settings();
    if (stored.session && !isActive(stored, now)) {
      const ended = { ...stored, session: null };
      await deps.store.set(KEY, ended);
      return ended;
    }
    return stored;
  }

  /** One clock reading for the whole report, so a deadline cannot pass halfway through it. */
  async function report(wanted: FocusSettings, now = deps.now()): Promise<FocusState> {
    const focusPage = await deps.hasSiteAccess().catch(() => false);
    return {
      settings: wanted,
      session: isActive(wanted, now) ? wanted.session : null,
      enforcement: await enforcement(wanted, focusPage, now),
      focusPage,
      supported: deps.dnr !== null,
    };
  }

  return {
    /** Checks the clock against the deadline (lifting expired rules), then reports. */
    state(): Promise<FocusState> {
      return serial(async () => {
        const now = deps.now();
        const stored = await settings();
        const wanted = await current(now);
        if (stored.session && !wanted.session) await apply(wanted);
        return report(wanted, now);
      });
    },

    /** Starts a session. While one is running nothing changes (no restart, no duplicate). */
    start(minutes: number, optional: FocusOptional): Promise<FocusState> {
      return serial(async () => {
        const stored = await current();
        if (stored.session) return report(stored);
        const length = focusMinutesSchema.parse(minutes);
        const now = deps.now();
        const next: FocusSettings = {
          optional,
          minutes: length,
          session: { startedAt: now, endsAt: now + length * 60_000, minutes: length },
        };
        await deps.store.set(KEY, next);
        await apply(next);
        if (deps.closeOpenTabs) {
          const { domains, except } = focusDomains(next);
          await deps.closeOpenTabs(matchPatterns(domains), except).catch(() => undefined);
        }
        return report(next);
      });
    },

    /** Ends the running session now; the extension's two-step "End early" flow ends here. */
    end(): Promise<FocusState> {
      return serial(async () => {
        const next = { ...(await current()), session: null };
        await deps.store.set(KEY, next);
        await apply(next);
        return report(next);
      });
    },

    /** Optional sites and the default duration change only between sessions. */
    configure(optional: FocusOptional, minutes: number): Promise<FocusState> {
      return serial(async () => {
        const stored = await current();
        if (stored.session) return report(stored);
        const next = { ...stored, optional, minutes: focusMinutesSchema.parse(minutes) };
        await deps.store.set(KEY, next);
        return report(next);
      });
    },

    /** Startup, worker wake, the end alarm and permission changes: expire or restore. */
    reconcile(): Promise<void> {
      return serial(async () => {
        await apply(await current());
      });
    },
  };
}
