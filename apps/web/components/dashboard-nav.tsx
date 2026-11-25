/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { Logo } from '@/components/logo';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/** 16px outline icons, 1.5px stroke, in the text colour. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const icons = {
  home: (
    <Icon>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
    </Icon>
  ),
  groups: (
    <Icon>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5" />
      <path d="M15.5 4.9a3.25 3.25 0 0 1 0 6.2M18 14.8c1.6.8 2.7 2.6 3 5.2" />
    </Icon>
  ),
  profile: (
    <Icon>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.5 20.5c.9-3.9 3.8-6.25 7.5-6.25s6.6 2.35 7.5 6.25" />
    </Icon>
  ),
  guide: (
    <Icon>
      <path d="M5 4.5h9.5L19 9v10.5H5z" />
      <path d="M14.5 4.5V9H19M8.5 13h7M8.5 16.5h5" />
    </Icon>
  ),
  about: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.75v.5" />
    </Icon>
  ),
  support: (
    <Icon>
      <path d="M4.5 6.5h15v10h-9l-4 3.5v-3.5h-2z" />
    </Icon>
  ),
};

const MAIN = [
  { href: '/dashboard', label: 'Home', icon: icons.home, exact: true },
  { href: '/dashboard/groups', label: 'Groups', icon: icons.groups, exact: false },
  { href: '/dashboard/profile', label: 'Profile', icon: icons.profile, exact: false },
] as const;

const LEARN = [
  { href: '/getting-started', label: 'Getting started', icon: icons.guide },
  { href: '/about', label: 'About Resolve', icon: icons.about },
  { href: '/support', label: 'Support', icon: icons.support },
] as const;

/** Shown while the link's page is loading (slow connections), so a click is never silent. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="ml-auto size-3.5" /> : null;
}

function NavLink({
  href,
  label,
  icon,
  current,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  current: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors lg:h-8',
        current
          ? 'bg-muted text-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {icon}
      {label}
      <Pending />
    </Link>
  );
}

function NavLists({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const learnId = useId();
  return (
    <>
      <nav aria-label="Dashboard">
        <ul className="space-y-0.5">
          {MAIN.map((item) => {
            const current = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <NavLink {...item} current={current} onNavigate={onNavigate} />
              </li>
            );
          })}
        </ul>
      </nav>
      <nav aria-labelledby={learnId} className="mt-8">
        <p id={learnId} className="text-muted-foreground mb-2 px-3 text-xs">
          Learn
        </p>
        <ul className="space-y-0.5">
          {LEARN.map((item) => (
            <li key={item.href}>
              <NavLink {...item} current={pathname === item.href} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function Account({ name, email }: { name: string | null; email: string | null }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 px-3">
        <span
          aria-hidden="true"
          className="bg-muted text-foreground grid size-8 shrink-0 place-items-center rounded-full text-sm font-medium"
        >
          {(name ?? email ?? '?').trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{name ?? email ?? 'Signed in'}</p>
          {name && email && <p className="text-muted-foreground truncate text-xs">{email}</p>}
        </div>
      </div>
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex h-10 w-full items-center rounded-lg px-3 text-left text-sm transition-colors lg:h-8"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

/**
 * The dashboard shell's navigation: a labelled sidebar on the page ground at desktop widths; on
 * smaller screens a top bar whose menu opens the same navigation as a full-screen sheet.
 */
export function DashboardNav({ name, email }: { name: string | null; email: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // The sheet closes when a link in it is followed (below), and with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 py-6 lg:flex">
        <Link
          href="/dashboard"
          className="mb-8 rounded-sm px-3"
          aria-label="Resolve dashboard home"
        >
          <Logo variant="horizontal-compact" height={24} priority />
        </Link>
        <NavLists pathname={pathname} />
        <div className="mt-auto pt-6">
          <Account name={name} email={email} />
        </div>
      </aside>

      <div className="bg-background sticky top-0 z-30 flex h-12 items-center justify-between border-b px-4 lg:hidden">
        <Link href="/dashboard" className="rounded-sm" aria-label="Resolve dashboard home">
          <Logo variant="horizontal-compact" height={20} priority />
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="dashboard-menu"
          onClick={() => {
            setOpen((v) => !v);
          }}
          className="hover:bg-muted -mr-2 inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open && (
        <div
          id="dashboard-menu"
          className="bg-background fixed inset-x-0 top-12 bottom-0 z-30 flex flex-col overflow-y-auto px-4 py-6 lg:hidden"
        >
          <NavLists
            pathname={pathname}
            onNavigate={() => {
              setOpen(false);
            }}
          />
          <div className="mt-8 border-t pt-6">
            <Account name={name} email={email} />
          </div>
        </div>
      )}
    </>
  );
}
