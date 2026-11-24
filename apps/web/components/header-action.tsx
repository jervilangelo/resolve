/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * The header's account entry point: "Sign in" for visitors, "Dashboard" for signed-in people,
 * and nothing inside the dashboard, whose own bar already shows the account and "Sign out".
 */
export function HeaderAction({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  if (signedIn && pathname.startsWith('/dashboard')) return null;
  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/dashboard" prefetch={false}>
        {signedIn ? 'Dashboard' : 'Sign in'}
      </Link>
    </Button>
  );
}
