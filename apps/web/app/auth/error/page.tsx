/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Sign-in problem' };

export default function AuthErrorPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
      <h1 className="font-display text-3xl">We could not sign you in</h1>
      <p className="text-muted-foreground mt-4">
        The sign-in link expired or was already used. Please try again.
      </p>
      <Button asChild className="mt-8">
        <Link href="/auth/login">Sign in again</Link>
      </Button>
    </section>
  );
}
