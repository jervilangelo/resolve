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
  type FeatureId,
  type Request,
  type ResponseMap,
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

/** Trigger A: reports qualifying blocked visits, once the user grants `webNavigation`. */
const reporter =
  account &&
  protection &&
  createNavigationReporter({
    rule: async () => protection.nonNegotiableRule((await auth.session())?.activeGroupId ?? null),
    report: (event) => account.reportEvent(event),
    now: () => Date.now(),
    randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

const onBeforeNavigate = (details: Parameters<NavigationReporter['onBeforeNavigate']>[0]) => {
  reporter?.onBeforeNavigate(details);
};
const onNavigationError = (details: Parameters<NavigationReporter['onErrorOccurred']>[0]) => {
  void reporter?.onErrorOccurred(details).catch(() => undefined);
};
const onTabRemoved = (tabId: number) => {
  reporter?.onTabRemoved(tabId);
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
  if (!browser.tabs.onRemoved.hasListener(onTabRemoved)) {
    browser.tabs.onRemoved.addListener(onTabRemoved);
  }
}
// Registered synchronously at startup when already granted, so blocked visits wake the worker.
listenForBlockedVisits();

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
    if (change.permissions?.includes('webNavigation')) listenForBlockedVisits();
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
