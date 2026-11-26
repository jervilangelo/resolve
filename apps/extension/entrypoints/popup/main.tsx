/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browser } from 'wxt/browser';
import { AccountPanel } from '@/components/account-panel';
import { BrandHeader } from '@/components/brand-header';
import { FeatureStatus } from '@/components/feature-status';
import { FocusPanel } from '@/components/focus-panel';
import { mount } from '@/lib/mount';

function Popup() {
  return (
    <div className="w-80">
      <BrandHeader />
      <main className="space-y-4 p-4">
        <div className="rounded-xl border p-3">
          <FocusPanel />
        </div>
        <AccountPanel />
        <section aria-labelledby="popup-protection" className="space-y-2">
          <h2 id="popup-protection" className="text-sm font-semibold">
            Protection
          </h2>
          <FeatureStatus />
        </section>
        <button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary-pressed w-full rounded-full px-3 py-2 text-sm font-medium transition-[background-color,transform] active:scale-[0.98]"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          Settings
        </button>
      </main>
    </div>
  );
}

mount(<Popup />);
