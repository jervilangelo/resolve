/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { type NavigationEventRequest, navigationEventRequestSchema } from '@resolve/contracts';
import { describe, expect, it } from 'vitest';
import {
  AUTOMATIC_NAVIGATION_WINDOW_MS,
  type NonNegotiableRule,
  STARTUP_GRACE_MS,
  createNavigationReporter,
} from './navigation';

const GROUP = 'grp_aaaaaaaaaaaaaaaaaaaaaaaaaa';
const BLOCKED = 'net::ERR_BLOCKED_BY_CLIENT';
const RULE: NonNegotiableRule = {
  groupId: GROUP,
  ruleVersion: 7,
  domains: ['blocked.example', 'google.com'],
  exempt: ['mail.google.com'],
  sid: 'sid-1',
};

function setup(rule: NonNegotiableRule | null = RULE) {
  let clock = Date.parse('2026-11-24T10:00:00Z');
  const reports: { event: NavigationEventRequest; expected: { sid: string; groupId: string } }[] =
    [];
  const responses: ('sent' | 'retry' | 'drop')[] = [];
  const cooldowns = new Map<string, number>();
  const reporter = createNavigationReporter({
    rule: () => Promise.resolve(rule),
    report: (event, expected) => {
      reports.push({ event, expected });
      return Promise.resolve(responses.shift() ?? 'sent');
    },
    now: () => clock,
    randomBytes: (n) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + reports.length) % 256),
    wait: () => Promise.resolve(),
    claimCooldown: (key, now, ms) => {
      const last = cooldowns.get(key);
      if (last !== undefined && now - last < ms) return Promise.resolve(false);
      cooldowns.set(key, now);
      return Promise.resolve(true);
    },
    releaseCooldown: (key, at) => {
      if (cooldowns.get(key) === at) cooldowns.delete(key);
      return Promise.resolve();
    },
  });
  /** A top-level navigation in tab 1 that the browser blocked. */
  const blockedVisit = (url: string, extra: Record<string, unknown> = {}, startUrl = url) => {
    reporter.onBeforeNavigate({ tabId: 1, frameId: 0, url: startUrl });
    return reporter.onErrorOccurred({ tabId: 1, frameId: 0, url, error: BLOCKED, ...extra });
  };
  /** A page that loaded normally in tab 1. */
  const pageLoaded = (url: string) => {
    reporter.onBeforeNavigate({ tabId: 1, frameId: 0, url });
    reporter.onCommitted({ tabId: 1, frameId: 0, url });
  };
  return {
    reporter,
    reports,
    responses,
    cooldowns,
    blockedVisit,
    pageLoaded,
    advance: (ms: number) => (clock += ms),
  };
}

describe('navigation reporter', () => {
  it('reports a deliberately opened non-negotiable page with a minimal event only', async () => {
    const t = setup();
    await t.blockedVisit('https://www.blocked.example/some/path?q=secret', {
      documentLifecycle: 'active',
    });
    expect(t.reports).toHaveLength(1);
    const report = t.reports[0];
    expect(navigationEventRequestSchema.parse(report?.event)).toEqual(report?.event);
    expect(report?.event).toMatchObject({ groupId: GROUP, clientRuleVersion: 7 });
    expect(report?.expected).toEqual({ sid: 'sid-1', groupId: GROUP });
    expect(JSON.stringify(report?.event)).not.toMatch(/blocked\.example|secret|path/);
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

  it('does not report redirects: server-side, or a page navigating right after it loaded', async () => {
    const t = setup();
    await t.blockedVisit('https://blocked.example/', {}, 'https://news.example/link');
    // A page (or ad) sends the tab to the blocked site moments after loading.
    t.pageLoaded('https://news.example/');
    t.advance(AUTOMATIC_NAVIGATION_WINDOW_MS - 1000);
    await t.blockedVisit('https://google.com/');
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

  it('reports a visit the person starts well after the previous page loaded', async () => {
    const t = setup();
    t.pageLoaded('https://news.example/');
    t.advance(AUTOMATIC_NAVIGATION_WINDOW_MS + 1000);
    await t.blockedVisit('https://blocked.example/');
    expect(t.reports).toHaveLength(1);
  });

  it('treats Resolve’s own blocked page as part of the same blocked visit', async () => {
    const t = setup();
    t.pageLoaded('https://news.example/');
    t.advance(AUTOMATIC_NAVIGATION_WINDOW_MS + 1);
    await t.blockedVisit('https://blocked.example/');
    expect(t.reports).toHaveLength(1);
    t.cooldowns.clear();
    t.reporter.onCommitted({ tabId: 1, frameId: 0, url: 'chrome-extension://abc/blocked.html' });
    await t.blockedVisit('https://blocked.example/'); // Back onto the blocked entry
    expect(t.reports).toHaveLength(1);
  });

  it('does not report pop-ups, restored tabs, reloads of a block page or startup restores', async () => {
    const t = setup();
    t.reporter.onCreatedNavigationTarget(1); // opened by another page
    await t.blockedVisit('https://blocked.example/');
    await t.blockedVisit('https://blocked.example/'); // reload of the block page
    t.pageLoaded('https://elsewhere.example/');
    t.advance(60_000);
    t.reporter.onTabDiscarded(1); // Memory Saver: the next load is a restore
    await t.blockedVisit('https://google.com/');
    expect(t.reports).toEqual([]);

    const s = setup();
    s.reporter.onBrowserStartup(); // session restore reloads tabs on its own
    await s.blockedVisit('https://blocked.example/');
    expect(s.reports).toEqual([]);
    s.advance(STARTUP_GRACE_MS + 1);
    await s.blockedVisit('https://google.com/');
    expect(s.reports).toHaveLength(1);
  });

  it('reports once per cooldown (kept outside memory), retrying only transient failures', async () => {
    const t = setup();
    await t.blockedVisit('https://blocked.example/');
    t.pageLoaded('https://news.example/');
    t.advance(AUTOMATIC_NAVIGATION_WINDOW_MS + 1);
    await t.blockedVisit('https://google.com/');
    expect(t.reports).toHaveLength(1);
    expect(t.cooldowns.has(`sid-1#${GROUP}`)).toBe(true);
    t.advance(10 * 60 * 1000 + 1);
    t.responses.push('retry', 'retry', 'sent');
    await t.blockedVisit('https://www.blocked.example/');
    expect(t.reports).toHaveLength(4);
    // The same event (same ID) is retried, so the server can deduplicate.
    expect(new Set(t.reports.slice(1).map((r) => r.event.eventId)).size).toBe(1);
  });

  it('frees the cooldown when a report could not be delivered', async () => {
    const t = setup();
    t.responses.push('drop');
    await t.blockedVisit('https://blocked.example/');
    t.pageLoaded('https://news.example/');
    t.advance(AUTOMATIC_NAVIGATION_WINDOW_MS + 1);
    await t.blockedVisit('https://google.com/');
    expect(t.reports).toHaveLength(2);
  });

  it('counts a visit typed right after opening a new tab page', async () => {
    const t = setup();
    t.reporter.onBeforeNavigate({ tabId: 1, frameId: 0, url: 'https://ntp.msn.com/edge/ntp' });
    t.reporter.onCommitted({
      tabId: 1,
      frameId: 0,
      url: 'https://ntp.msn.com/edge/ntp',
      transitionType: 'auto_toplevel',
    });
    t.advance(1500);
    await t.blockedVisit('https://blocked.example/');
    expect(t.reports).toHaveLength(1);
  });

  it('treats a block-page reload as a visit again only after a while', async () => {
    const t = setup();
    t.responses.push('drop'); // first one not delivered: the cooldown is freed
    await t.blockedVisit('https://blocked.example/');
    await t.blockedVisit('https://blocked.example/'); // immediate reload: ignored
    expect(t.reports).toHaveLength(1);
    t.advance(10 * 60 * 1000 + 1);
    await t.blockedVisit('https://blocked.example/');
    expect(t.reports).toHaveLength(2);
  });

  it('never reports a visit Focus Mode blocked, including essential sites the group exempts', async () => {
    // Focus blocks are plain ERR_BLOCKED_BY_CLIENT (without site access) for sites that are not
    // on the group's non-negotiable list, or are exempt from it as essential services.
    const t = setup({
      ...RULE,
      domains: [...RULE.domains, 'facebook.com'],
      exempt: [...RULE.exempt, 'facebook.com', 'youtube.com'],
    });
    for (const url of [
      'https://www.facebook.com/',
      'https://www.youtube.com/watch?v=1',
      'https://www.instagram.com/',
      'https://x.com/home',
      'https://www.reddit.com/r/all',
    ]) {
      t.advance(60_000);
      await t.blockedVisit(url, { documentLifecycle: 'active' });
    }
    expect(t.reports).toHaveLength(0);
  });

  it('does nothing without an active rule', async () => {
    const t = setup(null);
    await t.blockedVisit('https://blocked.example/');
    expect(t.reports).toEqual([]);
  });
});
