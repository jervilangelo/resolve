/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { RemovalReport } from './report';

export const metadata: Metadata = {
  title: 'Resolve was removed',
  robots: { index: false },
};

/**
 * The page the browser opens after Resolve is removed (its uninstall URL). When the owner had
 * removal alerts on, the URL fragment carries this browser's token, which is reported once.
 */
export default function RemovedPage() {
  return (
    <section className="mx-auto max-w-xl px-5 py-24 sm:px-6">
      <h1 className="font-display text-4xl leading-tight">Resolve was removed</h1>
      <p className="text-muted-foreground mt-5 text-lg leading-relaxed">
        Resolve is no longer installed in this browser. Your account, your groups and Resolve in
        your other browsers are unchanged.
      </p>
      <RemovalReport />
      <p className="mt-8 leading-relaxed">
        Removed it by mistake?{' '}
        <Link href="/downloads" className="underline underline-offset-4">
          Install Resolve again
        </Link>{' '}
        and sign in.
      </p>
    </section>
  );
}
