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

export const focusSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  optional: z.strictObject({ youtube: z.boolean(), netflix: z.boolean(), twitch: z.boolean() }),
});
export type FocusSettings = z.infer<typeof focusSettingsSchema>;

export const DEFAULT_FOCUS: FocusSettings = {
  enabled: false,
  optional: { youtube: false, netflix: false, twitch: false },
};

/**
 * What the browser is actually enforcing: `on` (rules installed as configured), `off`, or
 * `error` (the last update failed; the browser's rules are reported, not the intent).
 */
export type FocusEnforcement = 'on' | 'off' | 'error';

export interface FocusState {
  settings: FocusSettings;
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
}

const KEY = 'focus';

/** The domains blocked for the given settings, sorted and unique. */
export function focusDomains(settings: FocusSettings): { domains: string[]; except: string[] } {
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

export function compileFocusRules(settings: FocusSettings, focusPage: boolean): FocusRule[] {
  if (!settings.enabled) return [];
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

  /** Runs updates one at a time, so rapid toggling always ends in the last requested state. */
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  }

  async function settings(): Promise<FocusSettings> {
    const parsed = focusSettingsSchema.safeParse(await deps.store.get(KEY));
    return parsed.success ? parsed.data : DEFAULT_FOCUS;
  }

  async function enforcement(wanted: FocusSettings, focusPage: boolean): Promise<FocusEnforcement> {
    if (!deps.dnr) return 'off';
    const installed = (await deps.dnr.getRules()).filter((r) => inRange(r.id));
    if (!wanted.enabled) return installed.length === 0 ? 'off' : 'error';
    const expected = compileFocusRules(wanted, focusPage);
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

  /** Brings the browser's Focus rules in line with the stored settings (and nothing else). */
  async function apply(wanted: FocusSettings): Promise<void> {
    if (!deps.dnr) return;
    const focusPage = await deps.hasSiteAccess().catch(() => false);
    const existing = (await deps.dnr.getRules()).map((r) => r.id).filter(inRange);
    // A failure leaves the previous rules in place; state() then reports the mismatch.
    await deps.dnr.update(existing, compileFocusRules(wanted, focusPage)).catch(() => undefined);
  }

  async function state(): Promise<FocusState> {
    const wanted = await settings();
    const focusPage = await deps.hasSiteAccess().catch(() => false);
    return {
      settings: wanted,
      enforcement: await enforcement(wanted, focusPage),
      focusPage,
      supported: deps.dnr !== null,
    };
  }

  return {
    state,

    /** Saves new settings and enforces them; reports what the browser actually does afterwards. */
    update(next: FocusSettings): Promise<FocusState> {
      return serial(async () => {
        const previous = await settings();
        await deps.store.set(KEY, next);
        await apply(next);
        const turnedOn = next.enabled && !previous.enabled;
        const added = OPTIONAL_SERVICES.some((s) => next.optional[s] && !previous.optional[s]);
        if (next.enabled && (turnedOn || added) && deps.closeOpenTabs) {
          await deps
            .closeOpenTabs(matchPatterns(focusDomains(next).domains), focusDomains(next).except)
            .catch(() => undefined);
        }
        return state();
      });
    },

    /** Startup, worker wake and permission changes: restore the intended rules. */
    reconcile(): Promise<void> {
      return serial(async () => {
        await apply(await settings());
      });
    },
  };
}
