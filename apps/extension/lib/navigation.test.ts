/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { type NavigationEventRequest, navigationEventRequestSchema } from '@resolve/contracts';
import { describe, expect, it } from 'vitest';
import { type NonNegotiableRule, createNavigationReporter } from './navigation';

const GROUP = 'grp_aaaaaaaaaaaaaaaaaaaaaaaaaa';
const BLOCKED = 'net::ERR_BLOCKED_BY_CLIENT';

function setup(
  rule: NonNegotiableRule | null = {
    groupId: GROUP,
    ruleVersion: 7,
    domains: ['blocked.example', 'google.com'],
    exempt: ['mail.google.com'],
  },
) {
  let clock = Date.parse('2026-11-24T10:00:00Z');
  const reports: NavigationEventRequest[] = [];
  const responses: ('sent' | 'retry' | 'drop')[] = [];
  const reporter = createNavigationReporter({
    rule: () => Promise.resolve(rule),
    report: (event) => {
      reports.push(event);
      return Promise.resolve(responses.shift() ?? 'sent');
    },
    now: () => clock,
    randomBytes: (n) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + reports.length) % 256),
    wait: () => Promise.resolve(),
  });
  /** A top-level navigation that the browser blocked. */
  const blockedVisit = (url: string, extra: Record<string, unknown> = {}, startUrl = url) => {
    reporter.onBeforeNavigate({ tabId: 1, frameId: 0, url: startUrl });
    return reporter.onErrorOccurred({ tabId: 1, frameId: 0, url, error: BLOCKED, ...extra });
  };
  return {
    reporter,
    reports,
    responses,
    blockedVisit,
    advance: (ms: number) => (clock += ms),
  };
}

describe('navigation reporter', () => {
  it('reports a blocked non-negotiable page with a minimal event only', async () => {
    const t = setup();
    await t.blockedVisit('https://www.blocked.example/some/path?q=secret', {
      documentLifecycle: 'active',
    });
    expect(t.reports).toHaveLength(1);
    const [event] = t.reports;
    expect(navigationEventRequestSchema.parse(event)).toEqual(event);
    expect(event).toMatchObject({ groupId: GROUP, clientRuleVersion: 7 });
    expect(JSON.stringify(event)).not.toMatch(/blocked\.example|secret|path/);
  });

  it('ignores frames, other errors, prerenders, exempt and unlisted sites', async () => {
    const t = setup();
    t.reporter.onBeforeNavigate({ tabId: 1, frameId: 3, url: 'https://blocked.example/' });
    await t.reporter.onErrorOccurred({
      tabId: 1,
      frameId: 3,
      url: 'https://blocked.example/',
      error: BLOCKED,
    });
    await t.blockedVisit('https://blocked.example/', { error: 'net::ERR_NAME_NOT_RESOLVED' });
    await t.blockedVisit('https://blocked.example/', { documentLifecycle: 'prerender' });
    await t.blockedVisit('https://mail.google.com/'); // essential, exempt
    await t.blockedVisit('https://other.example/'); // blocked by something else, not our list
    expect(t.reports).toEqual([]);
  });

  it('does not report a redirect from another site into a blocked one', async () => {
    const t = setup();
    await t.blockedVisit('https://blocked.example/', {}, 'https://news.example/link');
    expect(t.reports).toEqual([]);
    // Without a recorded start (e.g. the worker restarted mid-navigation): not reported either.
    await t.reporter.onErrorOccurred({
      tabId: 9,
      frameId: 0,
      url: 'https://blocked.example/',
      error: BLOCKED,
    });
    expect(t.reports).toEqual([]);
  });

  it('reports once per cooldown, and retries only transient failures', async () => {
    const t = setup();
    await t.blockedVisit('https://blocked.example/');
    await t.blockedVisit('https://google.com/');
    expect(t.reports).toHaveLength(1);
    t.advance(10 * 60 * 1000 + 1);
    t.responses.push('retry', 'retry', 'sent');
    await t.blockedVisit('https://blocked.example/');
    expect(t.reports).toHaveLength(4);
    // The same event (same ID) is retried, so the server can deduplicate.
    expect(new Set(t.reports.slice(1).map((r) => r.eventId)).size).toBe(1);
  });

  it('frees the cooldown when a report could not be delivered', async () => {
    const t = setup();
    t.responses.push('drop');
    await t.blockedVisit('https://blocked.example/');
    await t.blockedVisit('https://blocked.example/');
    expect(t.reports).toHaveLength(2);
  });

  it('does nothing without an active rule', async () => {
    const t = setup(null);
    await t.blockedVisit('https://blocked.example/');
    expect(t.reports).toEqual([]);
  });
});
