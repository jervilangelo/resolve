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
      void (async (): Promise<DashboardStatus> => ({
        signedIn: Boolean(await auth?.session()),
        mediaBlur: (await filter.status()).status === 'on',
      }))().then(sendResponse, () => {
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
