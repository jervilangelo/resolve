/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { ReactNode } from 'react';
import { AccountPanel } from '@/components/account-panel';
import { AlertsPanel } from '@/components/alerts-panel';
import { BrandHeader } from '@/components/brand-header';
import { FeatureStatus } from '@/components/feature-status';
import { FocusPanel } from '@/components/focus-panel';
import { MediaFilterPanel } from '@/components/media-filter-panel';
import { mount } from '@/lib/mount';

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="bg-card space-y-4 rounded-2xl border p-5">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Options() {
  return (
    <div className="bg-background mx-auto min-h-dvh max-w-2xl">
      <BrandHeader />
      <main className="space-y-4 p-6">
        <h1 className="font-display mb-2 text-2xl">Settings</h1>
        <Card id="account" title="Account and group">
          <AccountPanel />
        </Card>
        <section aria-label="Focus Mode" className="bg-card rounded-2xl border p-5">
          <FocusPanel />
        </section>
        <Card id="media-filter" title="Media blurring">
          <MediaFilterPanel />
        </Card>
        <Card id="alerts" title="Blocked-visit alerts">
          <AlertsPanel />
        </Card>
        <Card id="features" title="Protection in this browser">
          <FeatureStatus />
        </Card>
        <p className="text-muted-foreground px-1 text-xs">
          Resolve is a supporting tool: it can be turned off, the AI makes mistakes, and only this
          browser is covered. Pages a site saved for offline use may still open.
        </p>
      </main>
    </div>
  );
}

mount(<Options />);
