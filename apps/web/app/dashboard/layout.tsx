/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <nav aria-label="Dashboard" className="flex gap-4 text-sm font-medium">
          <Link href="/dashboard/groups" className="hover:underline">
            Groups
          </Link>
          <Link href="/dashboard/profile" className="hover:underline">
            Profile
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {session.email && <span className="text-muted-foreground">{session.email}</span>}
          <form action="/auth/logout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
      <div className="pt-8">{children}</div>
    </div>
  );
}
