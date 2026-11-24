/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="rounded-sm" aria-label="Resolve home">
          <Logo variant="horizontal-compact" height={28} priority />
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard" prefetch={false}>
            Sign in
          </Link>
        </Button>
      </div>
    </header>
  );
}
