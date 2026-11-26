/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browser } from 'wxt/browser';

/** Leaves a blocked page: closes its tab, first opening a new tab if it is the window's last. */
export async function leaveTab(): Promise<void> {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id === undefined) {
    window.close();
    return;
  }
  const siblings = await browser.tabs.query({ windowId: tab.windowId });
  if (siblings.length <= 1) await browser.tabs.create({ windowId: tab.windowId });
  await browser.tabs.remove(tab.id);
}
