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
import { type Request, type ResponseMap, isExtensionPage, parseRequest } from '@/lib/messages';
import { privateStore } from '@/lib/private-store';
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

/** Re-checks the active group's rules periodically, so changes and removals take effect. */
const SYNC_ALARM = 'rules-sync';
const SYNC_PERIOD_MINUTES = 15;

const unconfigured = { state: 'unconfigured' } as const;

const handlers: {
  [K in Request['type']]: (request: Extract<Request, { type: K }>) => Promise<ResponseMap[K]>;
} = {
  'status/get': () => Promise.resolve(buildStatus(browser.runtime.getManifest().version)),
  'account/get': () => account?.state() ?? Promise.resolve(unconfigured),
  'account/signIn': () => account?.signIn() ?? Promise.resolve(unconfigured),
  'account/signOut': () => account?.signOut() ?? Promise.resolve(unconfigured),
  'protection/retry': () => account?.retryProtection() ?? Promise.resolve(unconfigured),
  'group/setActive': (request) =>
    account?.setActiveGroup(request.groupId) ?? Promise.resolve(unconfigured),
};

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

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    // Only this extension's own pages; content scripts share the sender ID but not the origin.
    if (sender.id !== browser.runtime.id) return;
    if (!isExtensionPage(sender.url, browser.runtime.getURL('/'))) return;
    const request = parseRequest(message);
    if (!request) return;
    handle(request).then(sendResponse, () => {
      sendResponse(undefined);
    });
    return true; // keep the channel open for the asynchronous response
  });
});
