/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { type Request, type ResponseMap, parseRequest } from '@/lib/messages';
import { buildStatus } from '@/lib/status';

const handlers: { [K in Request['type']]: () => ResponseMap[K] } = {
  'status/get': () => buildStatus(browser.runtime.getManifest().version),
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    // Only accept messages from this extension's own pages and scripts.
    if (sender.id !== browser.runtime.id) return;
    const request = parseRequest(message);
    if (request) sendResponse(handlers[request.type]());
  });
});
