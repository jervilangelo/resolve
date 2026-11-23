/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browser } from 'wxt/browser';
import { BrandHeader } from '@/components/brand-header';
import { FeatureStatus } from '@/components/feature-status';
import { mount } from '@/lib/mount';

function Popup() {
  return (
    <div className="w-80">
      <BrandHeader />
      <main className="space-y-4 p-4">
        <FeatureStatus />
        <button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary-pressed w-full rounded-md px-3 py-2 text-sm font-medium"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          Settings
        </button>
      </main>
    </div>
  );
}

mount(<Popup />);
