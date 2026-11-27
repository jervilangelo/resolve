/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import { authConfig } from '@/lib/auth';
import { logoutUrl } from '@/lib/cognito';

export const metadata: Metadata = { title: 'Signing out', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Local cookies are already cleared; this page then ends the Cognito managed login session by
 * navigating (not form-redirecting) to its logout endpoint, so the CSP form-action never has to
 * allow the Cognito domain.
 */
export default function SignedOutPage() {
  const { env, cognito } = authConfig();
  const url = logoutUrl(cognito, new URL(env.NEXT_PUBLIC_SITE_URL).origin);
  return (
    <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
      <meta httpEquiv="refresh" content={`0;url=${url}`} />
      <h1 className="font-display text-3xl">Signing you out…</h1>
      <p className="text-muted-foreground mt-4">
        If nothing happens,{' '}
        <a href={url} className="text-primary underline">
          continue
        </a>
        .
      </p>
    </section>
  );
}
