/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { EVENT_COOLDOWN_SECONDS, type NavigationEventRequest } from '@resolve/contracts';
import { coveredBy, normalizeHost } from '@resolve/domain-policy';

/**
 * Trigger A on the device (docs/MASTER_PLAN.md §4.4, §7.1). Observes top-level navigations that
 * the browser blocked and reports only those that look like the person's own, deliberate visit to
 * a site under the active group's non-negotiable rule. A false alert is worse than a missed one,
 * so whenever a block could have happened without the person choosing it, it is not reported:
 *
 * - frames, subresources and prerendered/background loads;
 * - navigations a different site redirected into the blocked one (server redirects);
 * - navigations starting moments after another page loaded in the same tab (script or meta
 *   redirects, typically ads);
 * - the first navigation in a tab another page opened (pop-ups and pop-unders);
 * - tabs being restored: browser start-up with session restore, discarded tabs reloading, and
 *   reloads of a page that was already blocked;
 * - essential services, other extensions' blocks, and repeats within the cooldown.
 *
 * Page addresses are seen only in memory, to make these decisions; nothing about the page (URL,
 * domain, title) is stored or sent. The report is a minimal event.
 */
export interface NonNegotiableRule {
  groupId: string;
  ruleVersion: number;
  domains: readonly string[];
  /** Essential services exempt from blocking (never reported either). */
  exempt: readonly string[];
  /** The sign-in the rule belongs to; a report is sent only while it is still current. */
  sid: string;
}

export interface NavigationDetails {
  tabId: number;
  frameId: number;
  url: string;
  /** onCommitted only: how the page was reached (e.g. 'link', 'typed', 'auto_toplevel'). */
  transitionType?: string;
  /** Chromium 106+: 'prerender' | 'active' | 'cached' | 'pending_deletion'. */
  documentLifecycle?: string;
}

export interface NavigationErrorDetails extends NavigationDetails {
  error: string;
}

export interface ReporterDeps {
  /** The non-negotiable rule currently enforced for the active group, or null. */
  rule(): Promise<NonNegotiableRule | null>;
  /** Sends one attempt; `sid` lets the sender drop it if the sign-in or group has changed. */
  report(
    event: NavigationEventRequest,
    expected: { sid: string; groupId: string },
  ): Promise<'sent' | 'retry' | 'drop'>;
  now(): number;
  randomBytes(length: number): Uint8Array;
  /** Waits before a retry (injected so tests do not sleep). */
  wait(ms: number): Promise<void>;
  /**
   * Atomically takes the cooldown slot for `key` (sign-in + group) if it is free at `now`;
   * persistent, so a service worker restart does not reset it.
   */
  claimCooldown(key: string, now: number, cooldownMs: number): Promise<boolean>;
  /** Frees the slot, but only if it still holds this report's time. */
  releaseCooldown(key: string, at: number): Promise<void>;
}

const BLOCKED_BY_CLIENT = 'net::ERR_BLOCKED_BY_CLIENT';
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** Short enough that every attempt runs before an idle MV3 service worker is stopped (~30 s). */
const RETRY_DELAYS_MS = [1_000, 3_000, 8_000];
/** A navigation this soon after another page loaded in the tab may not be the person's own. */
export const AUTOMATIC_NAVIGATION_WINDOW_MS = 5_000;
/** After the browser starts, restored tabs reload on their own. */
export const STARTUP_GRACE_MS = 20_000;

interface TabState {
  /** Host the current top-level navigation started at. */
  startedHost?: string;
  /** Last page that loaded in the tab, and when. */
  committedHost?: string;
  committedAt?: number;
  /** The tab was opened by another page and has not yet navigated on its own. */
  openedByPage?: boolean;
  /** The tab was discarded; its next load is the browser restoring it. */
  restoring?: boolean;
  /** The host last blocked in this tab, and when (a reload of the block page is not a visit). */
  blockedHost?: string;
  blockedAt?: number;
}

/** Pages the browser opens itself (new tab page, start page) never redirect anywhere. */
const BROWSER_OPENED = new Set(['auto_toplevel', 'start_page']);
/** A reload of a block page within this time is not a new visit. */
const RELOAD_WINDOW_MS = EVENT_COOLDOWN_SECONDS * 1000;

function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return normalizeHost(parsed.hostname);
  } catch {
    return null;
  }
}

export function createNavigationReporter(deps: ReporterDeps) {
  const tabs = new Map<number, TabState>();
  let browserStartedAt: number | null = null;
  const tab = (tabId: number) => {
    let state = tabs.get(tabId);
    if (!state) {
      state = {};
      tabs.set(tabId, state);
    }
    return state;
  };

  const eventId = () =>
    `evt_${Array.from(deps.randomBytes(26), (b) => BASE32[b % 32] ?? 'a').join('')}`;

  async function send(event: NavigationEventRequest, rule: NonNegotiableRule) {
    const expected = { sid: rule.sid, groupId: rule.groupId };
    for (let attempt = 0; ; attempt++) {
      const result = await deps.report(event, expected);
      const delay = RETRY_DELAYS_MS[attempt];
      if (result !== 'retry' || delay === undefined) return result;
      await deps.wait(delay);
    }
  }

  /** Whether this blocked navigation should be treated as the person's own deliberate visit. */
  function deliberate(state: TabState, host: string, now: number): boolean {
    if (state.openedByPage || state.restoring) return false;
    if (browserStartedAt !== null && now - browserStartedAt < STARTUP_GRACE_MS) return false;
    // A different site redirecting into a blocked one is not the person's own navigation.
    if (state.startedHost !== host) return false;
    // Reloading the block page, or going back to it, is not a new visit.
    if (
      state.blockedHost === host &&
      state.blockedAt !== undefined &&
      now - state.blockedAt < RELOAD_WINDOW_MS
    ) {
      return false;
    }
    // Moments after another page loaded: likely a script, meta refresh or ad redirect.
    if (
      state.committedAt !== undefined &&
      state.committedHost !== host &&
      now - state.committedAt < AUTOMATIC_NAVIGATION_WINDOW_MS
    ) {
      return false;
    }
    return true;
  }

  return {
    /** The browser just started (restored tabs reload on their own for a while). */
    onBrowserStartup(): void {
      browserStartedAt = deps.now();
    },

    /** Another page opened this tab (window.open, target=_blank, pop-unders). */
    onCreatedNavigationTarget(tabId: number): void {
      tab(tabId).openedByPage = true;
    },

    onTabDiscarded(tabId: number): void {
      tab(tabId).restoring = true;
    },

    onBeforeNavigate(details: NavigationDetails): void {
      if (details.frameId !== 0) return;
      const host = hostOf(details.url);
      tab(details.tabId).startedHost = host ?? undefined;
    },

    /** A page loaded in the tab: the tab is now the person's own again. */
    onCommitted(details: NavigationDetails): void {
      if (details.frameId !== 0) return;
      const state = tab(details.tabId);
      // Only web pages that could redirect on their own start the automatic-navigation window;
      // a new tab page the person is typing into does not.
      const host = hostOf(details.url);
      const browserOpened = BROWSER_OPENED.has(details.transitionType ?? '');
      state.committedHost = host && !browserOpened ? host : undefined;
      state.committedAt = host && !browserOpened ? deps.now() : undefined;
      state.openedByPage = false;
      state.restoring = false;
      state.blockedHost = undefined;
    },

    /** Resolves once any report for this navigation has been sent (or given up). */
    async onErrorOccurred(details: NavigationErrorDetails): Promise<void> {
      if (details.frameId !== 0) return;
      const state = tab(details.tabId);
      const host = hostOf(details.url);
      const isDeliberate = host !== null && deliberate(state, host, deps.now());
      // Whatever happens below, this tab's navigation is over.
      const startedHost = state.startedHost;
      state.startedHost = undefined;
      state.openedByPage = false;
      state.restoring = false;
      if (details.error !== BLOCKED_BY_CLIENT || !host) return;
      state.blockedHost = host;
      state.blockedAt = deps.now();
      // Only pages the person is actually looking at; never prerendered or background loads.
      if (details.documentLifecycle !== undefined && details.documentLifecycle !== 'active') return;
      if (!isDeliberate || startedHost !== host) return;

      const rule = await deps.rule();
      if (!rule) return;
      if (rule.exempt.some((domain) => coveredBy(host, domain))) return;
      if (!rule.domains.some((domain) => coveredBy(host, domain))) return;

      const now = deps.now();
      const cooldownKey = `${rule.sid}#${rule.groupId}`;
      if (!(await deps.claimCooldown(cooldownKey, now, EVENT_COOLDOWN_SECONDS * 1000))) return;

      const result = await send(
        {
          eventId: eventId(),
          groupId: rule.groupId,
          eventType: 'NON_NEGOTIABLE_NAVIGATION',
          occurredAt: new Date(now).toISOString(),
          clientRuleVersion: rule.ruleVersion,
        },
        rule,
      );
      // Not delivered: the next qualifying visit may report instead of waiting out the cooldown.
      if (result !== 'sent') await deps.releaseCooldown(cooldownKey, now);
    },

    onTabRemoved(tabId: number): void {
      tabs.delete(tabId);
    },
  };
}

export type NavigationReporter = ReturnType<typeof createNavigationReporter>;
