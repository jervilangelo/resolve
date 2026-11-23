/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
      <h1 className="font-display text-3xl">Page not found</h1>
      <p className="text-muted-foreground mt-4">The page you requested does not exist.</p>
      <Button asChild className="mt-8">
        <Link href="/">Return home</Link>
      </Button>
    </section>
  );
}
