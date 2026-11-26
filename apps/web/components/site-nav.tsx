/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { PUBLIC_NAV } from '@/lib/site';
import { cn } from '@/lib/utils';

/** Public header: logo, the five places a visitor looks for, and the account action. */
export function SiteNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
  };

  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="rounded-sm" aria-label="Resolve home" onClick={close}>
          <Logo variant="horizontal-compact" height={26} priority />
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {PUBLIC_NAV.map((item) => {
              const current = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'rounded-full px-3 py-2 text-sm transition-colors',
                      current
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {!signedIn && (
            <Link
              href="/dashboard"
              prefetch={false}
              className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm transition-colors"
            >
              Sign in
            </Link>
          )}
          <Button asChild size="sm">
            <Link href="/dashboard" prefetch={false}>
              {signedIn ? 'Dashboard' : 'Get started'}
            </Link>
          </Button>
        </div>
        <button
          type="button"
          className="hover:bg-muted -mr-2 inline-flex h-11 items-center rounded-full px-4 text-sm font-medium md:hidden"
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => {
            setOpen((v) => !v);
          }}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open && (
        <div id="site-menu" className="rs-page border-t md:hidden">
          <nav aria-label="Main" className="mx-auto max-w-6xl px-5 py-4 sm:px-8">
            <ul className="space-y-1">
              {PUBLIC_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className="hover:bg-muted flex h-11 items-center rounded-lg px-3 text-base"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-4 w-full" size="lg">
              <Link href="/dashboard" prefetch={false} onClick={close}>
                {signedIn ? 'Open dashboard' : 'Sign in or create an account'}
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
