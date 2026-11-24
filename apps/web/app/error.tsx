/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  // reset() alone re-renders the cached server output; refresh() fetches it again.
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
  return (
    <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6" role="alert">
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="text-muted-foreground mt-4">Please try again.</p>
      <Button className="mt-8" onClick={retry}>
        Try again
      </Button>
    </section>
  );
}
