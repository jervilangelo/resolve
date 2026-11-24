/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard/groups', label: 'Groups' },
  { href: '/dashboard/profile', label: 'Profile' },
] as const;

/** Dashboard sections; the current one is marked for sighted and screen-reader users alike. */
export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-4 text-sm font-medium">
      {LINKS.map(({ href, label }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'underline-offset-8 hover:underline',
              current ? 'underline decoration-2' : 'text-muted-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
