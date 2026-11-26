/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { createAccount } from '@/lib/account';
import { createAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { z } from 'zod';
import { ALL_FOCUS_PATTERNS, FOCUS_PAGE, type FocusRule, createFocus } from '@/lib/focus';
import { createFilterController } from '@/lib/media/controller';
import { createMediaEngine } from '@/lib/media/engine';
import {
  type ContentRequest,
  type ContentResponseMap,
  contentRequestSchema,
} from '@/lib/media/protocol';
import {
  SITE_ACCESS,
  classifyOffscreen,
  hasSiteAccess,
  scriptRegistration,
  supportsMediaFilter,
} from '@/lib/media/registration';
import {
  type AlertsStatus,
  type FeatureId,
  type Request,
  type DashboardStatus,
  type ResponseMap,
  dashboardRequestSchema,
  isDashboardOrigin,
  isExtensionPage,
  parseRequest,
} from '@/lib/messages';
import { privateStore } from '@/lib/private-store';
import { type NavigationReporter, createNavigationReporter } from '@/lib/navigation';
import { type DnrRule, createProtection } from '@/lib/protection';
import { buildStatus } from '@/lib/status';

const auth =
  config &&
  createAuth(config, {
    launchWebAuthFlow: (url) => browser.identity.launchWebAuthFlow({ url, interactive: true }),
    redirectUrl: () => browser.identity.getRedirectURL(),
    store: privateStore,
    fetch: (...args) => fetch(...args),
    now: () => Date.now(),
    random: (bytes) => crypto.getRandomValues(new Uint8Array(bytes)),
  });

const account =
  config && auth && createAccount(config, auth, { fetch: (...args) => fetch(...args) });

const protection =
  account &&
  createProtection({
    dnr: {
      getRuleIds: async () =>
        (await browser.declarativeNetRequest.getDynamicRules()).map((rule) => rule.id),
      update: (removeRuleIds: number[], addRules: DnrRule[]) =>
        browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules }),
    },
    store: privateStore,
    fetchRules: (groupId, version, essentialVersion) =>
      account.fetchRules(groupId, version, essentialVersion),
    activeGroup: async () => (await auth.session())?.activeGroupId ?? null,
    now: () => Date.now(),
  });
if (account && protection) account.attachProtection(protection);

const ALERT_COOLDOWNS = 'alertCooldowns';

/** Trigger A: reports qualifying blocked visits, once the user grants `webNavigation`. */
const reporter =
  account &&
  protection &&
  createNavigationReporter({
    rule: async () => {
      const session = await auth.session();
      if (!session) return null;
      const rule = await protection.nonNegotiableRule(session.activeGroupId ?? null);
      return rule && { ...rule, sid: session.sid };
    },
    report: (event, expected) => account.reportEvent(event, expected),
    now: () => Date.now(),
    randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    // In the private store (one atomic transaction) so a worker restart does not reset it and
    // two tabs cannot both take the slot. Expired entries are dropped on every write.
    claimCooldown: async (key, now, cooldownMs) => {
      let claimed = false;
      await privateStore.update(ALERT_COOLDOWNS, (raw) => {
        const parsed = z.record(z.string(), z.number()).safeParse(raw);
        const live = Object.entries(parsed.success ? parsed.data : {}).filter(
          ([, at]) => now - at < cooldownMs,
        );
        if (live.some(([id]) => id === key)) return Object.fromEntries(live);
        claimed = true;
        return Object.fromEntries([...live, [key, now]]);
      });
      return claimed;
    },
    releaseCooldown: async (key, at) => {
      await privateStore.update(ALERT_COOLDOWNS, (raw) => {
        const parsed = z.record(z.string(), z.number()).safeParse(raw);
        const all = parsed.success ? parsed.data : {};
        return Object.fromEntries(
          Object.entries(all).filter(([id, value]) => !(id === key && value === at)),
        );
      });
    },
  });

/** Alerts status for the popup and settings: "on" only when a report could actually be sent. */
async function alertsStatus(): Promise<AlertsStatus> {
  const api = (browser as Partial<typeof browser>).webNavigation;
  if (!browser.runtime.getManifest().optional_permissions?.includes('webNavigation')) {
    return { state: 'unsupported' };
  }
  if (!api || !(await browser.permissions.contains({ permissions: ['webNavigation'] }))) {
    return { state: 'off' };
  }
  // A build without account settings cannot sign in, so it can never report.
  if (!reporter) return { state: 'inactive', reason: 'signedOut' };
  const session = await auth.session();
  if (!session) return { state: 'inactive', reason: 'signedOut' };
  if (!session.activeGroupId) return { state: 'inactive', reason: 'noGroup' };
  if (!(await protection.nonNegotiableRule(session.activeGroupId))) {
    return { state: 'inactive', reason: 'noRestrictions' };
  }
  return { state: 'on' };
}

const onBeforeNavigate = (details: Parameters<NavigationReporter['onBeforeNavigate']>[0]) => {
  reporter?.onBeforeNavigate(details);
};
const onNavigationError = (details: Parameters<NavigationReporter['onErrorOccurred']>[0]) => {
  void reporter?.onErrorOccurred(details).catch(() => undefined);
};
const onTabRemoved = (tabId: number) => {
  reporter?.onTabRemoved(tabId);
};
const onCommitted = (details: Parameters<NavigationReporter['onCommitted']>[0]) => {
  reporter?.onCommitted(details);
};
const onCreatedTarget = (details: { tabId: number }) => {
  reporter?.onCreatedNavigationTarget(details.tabId);
};
const onTabUpdated = (tabId: number, change: { discarded?: boolean }) => {
  if (change.discarded === true) reporter?.onTabDiscarded(tabId);
};

/**
 * Listens only while the optional permission is granted (the API is absent otherwise). Safe to
 * call again after a re-grant: each listener is attached at most once to the current API object.
 */
function listenForBlockedVisits(): void {
  const api = (browser as Partial<typeof browser>).webNavigation;
  if (!reporter || !api) return;
  if (!api.onBeforeNavigate.hasListener(onBeforeNavigate)) {
    api.onBeforeNavigate.addListener(onBeforeNavigate);
  }
  if (!api.onErrorOccurred.hasListener(onNavigationError)) {
    api.onErrorOccurred.addListener(onNavigationError);
  }
  if (!api.onCommitted.hasListener(onCommitted)) api.onCommitted.addListener(onCommitted);
  if (!api.onCreatedNavigationTarget.hasListener(onCreatedTarget)) {
    api.onCreatedNavigationTarget.addListener(onCreatedTarget);
  }
  if (!browser.tabs.onRemoved.hasListener(onTabRemoved)) {
    browser.tabs.onRemoved.addListener(onTabRemoved);
  }
  // Chromium does not support event filters on tabs.onUpdated (only Firefox does); passing one
  // throws, which at start-up would stop the whole worker. Plain listener; it returns at once.
  if (!browser.tabs.onUpdated.hasListener(onTabUpdated)) {
    browser.tabs.onUpdated.addListener(onTabUpdated);
  }
}
// Registered synchronously at startup when already granted, so blocked visits wake the worker.
// Never allowed to fail the worker: every other feature (sign-in, rules, media) must keep working.
try {
  listenForBlockedVisits();
} catch {
  // Alerts stay inactive; the status reflects that.
}
// Restored tabs reload on their own after the browser starts; those are never reported.
browser.runtime.onStartup.addListener(() => {
  reporter?.onBrowserStartup();
});

const focusAccess = () => browser.permissions.contains({ origins: ALL_FOCUS_PATTERNS });
const FOCUS_END_ALARM = 'focus-end';
let focusEndTimer: ReturnType<typeof setTimeout> | undefined;

// Typed as always present, but absent where the browser lacks declarativeNetRequest.
const dnrApi = (browser as { declarativeNetRequest?: typeof browser.declarativeNetRequest })
  .declarativeNetRequest;

const focus = createFocus({
  dnr: dnrApi
    ? {
        getRules: () => dnrApi.getDynamicRules(),
        update: (removeRuleIds: number[], addRules: FocusRule[]) =>
          dnrApi.updateDynamicRules({ removeRuleIds, addRules }),
      }
    : null,
  store: privateStore,
  hasSiteAccess: focusAccess,
  notify: () => {
    // No page open is the normal case; nothing to deliver then.
    browser.runtime.sendMessage({ type: 'focus/changed' }).catch(() => undefined);
  },
  now: () => Date.now(),
  // The alarm survives worker suspension and restarts; while the worker is awake a timer also
  // ends the session on the second (alarms may run up to a minute late).
  scheduleEnd: async (at) => {
    clearTimeout(focusEndTimer);
    await browser.alarms.clear(FOCUS_END_ALARM);
    if (at === null) return;
    await browser.alarms.create(FOCUS_END_ALARM, { when: at });
    focusEndTimer = setTimeout(
      () => void focus.reconcile().catch(() => undefined),
      Math.max(0, at - Date.now()) + 50,
    );
  },
  // Rules apply to new navigations only; tabs already on a newly blocked site move to the page.
  closeOpenTabs: async (patterns, except) => {
    if (!(await focusAccess())) return;
    // `from=open`: going back would only return to the blocked site, so the page hides "Go back".
    const page = `${browser.runtime.getURL(FOCUS_PAGE)}?from=open`;
    const excepted = (url = '') => {
      const host = URL.canParse(url) ? new URL(url).hostname : '';
      return except.some((d) => host === d || host.endsWith(`.${d}`));
    };
    const tabs = await browser.tabs.query({ url: patterns });
    await Promise.allSettled(
      tabs
        .filter((tab) => tab.id !== undefined && !excepted(tab.url))
        .map((tab) => browser.tabs.update(tab.id, { url: page })),
    );
  },
});

const filter = createFilterController({
  store: privateStore,
  supported: supportsMediaFilter(),
  hasSiteAccess,
  registration: scriptRegistration,
});
const media = createMediaEngine({
  classify: classifyOffscreen,
  sensitivity: async () => (await filter.settings()).sensitivity,
});

/** Re-checks the active group's rules periodically, so changes and removals take effect. */
const SYNC_ALARM = 'rules-sync';
const SYNC_PERIOD_MINUTES = 15;

const unconfigured = { state: 'unconfigured' } as const;

const handlers: {
  [K in Request['type']]: (request: Extract<Request, { type: K }>) => Promise<ResponseMap[K]>;
} = {
  'status/get': () => {
    const manifest = browser.runtime.getManifest();
    const unsupported: FeatureId[] = [];
    if (!supportsMediaFilter()) unsupported.push('ai-filter');
    if (!manifest.optional_permissions?.includes('webNavigation'))
      unsupported.push('accountability');
    return Promise.resolve(buildStatus(manifest.version, unsupported));
  },
  'account/get': () => account?.state() ?? Promise.resolve(unconfigured),
  'account/signIn': () => account?.signIn() ?? Promise.resolve(unconfigured),
  'account/signOut': () => account?.signOut() ?? Promise.resolve(unconfigured),
  'protection/retry': () => account?.retryProtection() ?? Promise.resolve(unconfigured),
  'alerts/get': () => alertsStatus(),
  'group/setActive': (request) =>
    account?.setActiveGroup(request.groupId) ?? Promise.resolve(unconfigured),
  'filter/get': () => filter.state(),
  'filter/set': (request) => filter.update(request.settings),
  'focus/get': () => focus.state(),
  'focus/start': (request) => focus.start(request.minutes, request.optional),
  'focus/end': () => focus.end(),
  'focus/configure': (request) => focus.configure(request.optional, request.minutes),
};

/** The only requests content scripts (which run inside web pages) can make. */
const contentHandlers: {
  [K in ContentRequest['type']]: (
    request: Extract<ContentRequest, { type: K }>,
  ) => Promise<ContentResponseMap[K]>;
} = {
  'media/config': async () => {
    const { settings, status } = await filter.status();
    return { enabled: status === 'on', unverifiable: settings.unverifiable };
  },
  'media/classify': async (request) => {
    // A page script cannot reach this, but a page left open after the filter was turned off can.
    if (!(await filter.settings()).enabled) return { verdict: 'show' };
    return { verdict: await media.verdict(request.source) };
  },
};

function handleContent(request: ContentRequest): Promise<unknown> {
  const handler = contentHandlers[request.type] as (r: ContentRequest) => Promise<unknown>;
  return handler(request);
}

function handle(request: Request): Promise<unknown> {
  const handler = handlers[request.type] as (r: Request) => Promise<unknown>;
  return handler(request);
}

export default defineBackground(() => {
  // Focus Mode is local and needs no account: restore its rules on every worker start, and switch
  // between the Focus page and a plain block when site access is granted or withdrawn.
  void focus.reconcile().catch(() => undefined);
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === FOCUS_END_ALARM) void focus.reconcile().catch(() => undefined);
  });
  // Any site-access change can add or remove access to the Focus sites (e.g. <all_urls>).
  const onFocusAccess = (change: { origins?: string[] }) => {
    if (change.origins?.length) void focus.reconcile().catch(() => undefined);
  };
  browser.permissions.onAdded.addListener(onFocusAccess);
  browser.permissions.onRemoved.addListener(onFocusAccess);

  if (account) {
    // Created only when missing: re-creating on every worker wake would restart the countdown,
    // and frequent wakes could then postpone syncing indefinitely.
    void browser.alarms.get(SYNC_ALARM).then(async (existing) => {
      if (!existing)
        await browser.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES });
    });
    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === SYNC_ALARM) void account.syncActive();
    });
    browser.runtime.onStartup.addListener(() => void account.syncActive());
    browser.runtime.onInstalled.addListener(() => void account.syncActive());
  }

  // Blocked-visit alerts start as soon as the user grants the optional permission.
  browser.permissions.onAdded.addListener((change) => {
    if (!change.permissions?.includes('webNavigation')) return;
    try {
      listenForBlockedVisits();
    } catch {
      // Alerts stay inactive; the status reflects that.
    }
  });

  // The filter's content script registration persists across sessions; keep it in step with the
  // settings and with site access, which the user can withdraw in the browser at any time.
  void filter.reconcile().catch(() => undefined);
  if (supportsMediaFilter()) {
    const onAccessChange = (change: { origins?: string[] }) => {
      if (change.origins?.some((origin) => SITE_ACCESS.origins.includes(origin))) {
        void filter.reconcile().catch(() => undefined);
      }
    };
    browser.permissions.onAdded.addListener(onAccessChange);
    browser.permissions.onRemoved.addListener(onAccessChange);
  }

  // The dashboard's setup checklist asks whether this browser is signed in and blurring media.
  try {
    browser.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
      if (!isDashboardOrigin(sender.origin, config?.dashboardUrl)) return;
      if (!dashboardRequestSchema.safeParse(message).success) return;
      void (async (): Promise<DashboardStatus> => {
        // Each lookup falls back on its own, so one failure never hides the whole answer.
        const safe = <T>(work: () => Promise<T>, fallback: T) => work().catch(() => fallback);
        const session = await safe(async () => (await auth?.session()) ?? null, null);
        const active = session?.activeGroupId ?? null;
        const media = await safe(async () => (await filter.status()).status, 'off' as const);
        const guard = await safe(
          async () =>
            (await protection?.status(active)) ?? { state: 'off' as const, syncedAt: null },
          { state: 'error' as const, syncedAt: null },
        );
        const alerts = await safe(async () => (await alertsStatus()).state, 'off' as const);
        return {
          signedIn: Boolean(session),
          mediaBlur: media === 'on',
          version: browser.runtime.getManifest().version,
          activeGroupId: session ? active : null,
          protection: guard.state,
          syncedAt: guard.syncedAt,
          media,
          alerts,
        };
      })().then(sendResponse, () => {
        sendResponse(undefined);
      });
      return true;
    });
  } catch {
    // Not available in this browser: the dashboard shows the item as "not detected".
  }

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return;
    // Content scripts (sender.tab, a web page's URL) get the narrow media vocabulary only.
    if (sender.tab && !isExtensionPage(sender.url, browser.runtime.getURL('/'))) {
      const request = contentRequestSchema.safeParse(message);
      if (!request.success) return;
      handleContent(request.data).then(sendResponse, () => {
        sendResponse(undefined);
      });
      return true;
    }
    // Otherwise only this extension's own pages; content scripts share the sender ID, not the origin.
    if (!isExtensionPage(sender.url, browser.runtime.getURL('/'))) return;
    const request = parseRequest(message);
    if (!request) return;
    handle(request).then(sendResponse, () => {
      sendResponse(undefined);
    });
    return true; // keep the channel open for the asynchronous response
  });
});
