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
 * the browser blocked and reports only those that clearly match the active group's non-negotiable
 * rule. It is deliberately conservative: when unsure, it blocks without reporting. Nothing about
 * the page (URL, domain, title) ever leaves the device; the report is a minimal event.
 *
 * Not reported: frames and subresources, prerendered/background pages, navigations that a
 * different site redirected into a blocked one, blocks by other extensions on other domains,
 * and repeats within the cooldown.
 */
export interface NonNegotiableRule {
  groupId: string;
  ruleVersion: number;
  domains: readonly string[];
  /** Essential services exempt from blocking (never reported either). */
  exempt: readonly string[];
}

export interface NavigationDetails {
  tabId: number;
  frameId: number;
  url: string;
  /** Chromium 106+: 'prerender' | 'active' | 'cached' | 'pending_deletion'. */
  documentLifecycle?: string;
}

export interface NavigationErrorDetails extends NavigationDetails {
  error: string;
}

export interface ReporterDeps {
  /** The non-negotiable rule currently enforced for the active group, or null. */
  rule(): Promise<NonNegotiableRule | null>;
  report(event: NavigationEventRequest): Promise<'sent' | 'retry' | 'drop'>;
  now(): number;
  randomBytes(length: number): Uint8Array;
  /** Waits before a retry (injected so tests do not sleep). */
  wait(ms: number): Promise<void>;
}

const BLOCKED_BY_CLIENT = 'net::ERR_BLOCKED_BY_CLIENT';
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** Short enough that every attempt runs before an idle MV3 service worker is stopped (~30 s). */
const RETRY_DELAYS_MS = [1_000, 3_000, 8_000];

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
  /** The host each tab's current top-level navigation started at. */
  const started = new Map<number, string>();
  /** Last report time per group (the server enforces the same cooldown). */
  const lastReport = new Map<string, number>();

  const eventId = () =>
    `evt_${Array.from(deps.randomBytes(26), (b) => BASE32[b % 32] ?? 'a').join('')}`;

  async function send(event: NavigationEventRequest): Promise<'sent' | 'retry' | 'drop'> {
    for (let attempt = 0; ; attempt++) {
      const result = await deps.report(event);
      const delay = RETRY_DELAYS_MS[attempt];
      if (result !== 'retry' || delay === undefined) return result;
      await deps.wait(delay);
    }
  }

  return {
    onBeforeNavigate(details: NavigationDetails): void {
      if (details.frameId !== 0) return;
      const host = hostOf(details.url);
      if (host) started.set(details.tabId, host);
      else started.delete(details.tabId);
    },

    /** Resolves once any report for this navigation has been sent (or given up). */
    async onErrorOccurred(details: NavigationErrorDetails): Promise<void> {
      const startedAt = started.get(details.tabId);
      if (details.frameId !== 0) return;
      started.delete(details.tabId);
      if (details.error !== BLOCKED_BY_CLIENT) return;
      // Only pages the person is actually looking at; never prerendered or background loads.
      if (details.documentLifecycle !== undefined && details.documentLifecycle !== 'active') return;
      const host = hostOf(details.url);
      // A different site redirecting into a blocked one is not the person's own navigation.
      if (!host || startedAt !== host) return;

      const rule = await deps.rule();
      if (!rule) return;
      if (rule.exempt.some((domain) => coveredBy(host, domain))) return;
      if (!rule.domains.some((domain) => coveredBy(host, domain))) return;

      const now = deps.now();
      const last = lastReport.get(rule.groupId);
      if (last !== undefined && now - last < EVENT_COOLDOWN_SECONDS * 1000) return;
      lastReport.set(rule.groupId, now);

      const result = await send({
        eventId: eventId(),
        groupId: rule.groupId,
        eventType: 'NON_NEGOTIABLE_NAVIGATION',
        occurredAt: new Date(now).toISOString(),
        clientRuleVersion: rule.ruleVersion,
      });
      // Not delivered: the next qualifying visit may report instead of waiting out the cooldown.
      if (result !== 'sent' && lastReport.get(rule.groupId) === now)
        lastReport.delete(rule.groupId);
    },

    onTabRemoved(tabId: number): void {
      started.delete(tabId);
    },
  };
}

export type NavigationReporter = ReturnType<typeof createNavigationReporter>;
