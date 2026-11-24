/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { AccountPanel } from '@/components/account-panel';
import { BrandHeader } from '@/components/brand-header';
import { FeatureStatus } from '@/components/feature-status';
import { MediaFilterPanel } from '@/components/media-filter-panel';
import { mount } from '@/lib/mount';

function Options() {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl">
      <BrandHeader />
      <main className="space-y-6 p-6">
        <h1 className="font-display text-2xl">Settings</h1>
        <section aria-labelledby="account" className="space-y-3">
          <h2 id="account" className="font-semibold">
            Account and group
          </h2>
          <AccountPanel />
        </section>
        <section aria-labelledby="media-filter" className="space-y-3">
          <h2 id="media-filter" className="font-semibold">
            Media blurring
          </h2>
          <MediaFilterPanel />
        </section>
        <section aria-labelledby="features" className="space-y-3">
          <h2 id="features" className="font-semibold">
            Protection features
          </h2>
          <FeatureStatus />
        </section>
        <p className="text-muted-foreground text-sm">
          Resolve is a supporting tool. Browser protection can be bypassed and AI classification can
          make mistakes. Domain protection blocks page loads that go to the network; pages a site
          has stored for offline use may still open, and only this browser is covered.
        </p>
      </main>
    </div>
  );
}

mount(<Options />);
