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
import { buildStatus } from '@/lib/status';

const account =
  config &&
  createAccount(
    config,
    createAuth(config, {
      launchWebAuthFlow: (url) => browser.identity.launchWebAuthFlow({ url, interactive: true }),
      redirectUrl: () => browser.identity.getRedirectURL(),
      store: privateStore,
      fetch: (...args) => fetch(...args),
      now: () => Date.now(),
      random: (bytes) => crypto.getRandomValues(new Uint8Array(bytes)),
    }),
    { fetch: (...args) => fetch(...args) },
  );

const unconfigured = { state: 'unconfigured' } as const;

const handlers: {
  [K in Request['type']]: (request: Extract<Request, { type: K }>) => Promise<ResponseMap[K]>;
} = {
  'status/get': () => Promise.resolve(buildStatus(browser.runtime.getManifest().version)),
  'account/get': () => account?.state() ?? Promise.resolve(unconfigured),
  'account/signIn': () => account?.signIn() ?? Promise.resolve(unconfigured),
  'account/signOut': () => account?.signOut() ?? Promise.resolve(unconfigured),
  'group/setActive': (request) =>
    account?.setActiveGroup(request.groupId) ?? Promise.resolve(unconfigured),
};

function handle(request: Request): Promise<unknown> {
  const handler = handlers[request.type] as (r: Request) => Promise<unknown>;
  return handler(request);
}

export default defineBackground(() => {
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
