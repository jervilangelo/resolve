/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browser } from 'wxt/browser';
import { type Request, type ResponseMap, responseSchemas } from './messages';

/** Send a typed request to the background worker and validate its reply. */
export async function send<T extends Request['type']>(
  request: Extract<Request, { type: T }>,
): Promise<ResponseMap[T]> {
  const reply: unknown = await browser.runtime.sendMessage(request);
  return responseSchemas[request.type].parse(reply) as ResponseMap[T];
}
