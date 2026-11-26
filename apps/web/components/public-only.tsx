/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Public-site chrome (header, footer); the dashboard has its own shell. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return null;
  }
  return children;
}
