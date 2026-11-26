/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { CONTACT_EMAIL } from '@/lib/site';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/#features', label: 'Features' },
      { href: '/downloads', label: 'Download' },
      { href: '/tutorial', label: 'Tutorial' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/faq', label: 'FAQ' },
      { href: '/support', label: 'Support Resolve' },
      { href: '/about', label: 'About' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-muted/40 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo variant="horizontal-compact" height={24} />
          <p className="text-muted-foreground max-w-xs text-sm">
            Free browser protection and voluntary accountability for Christians.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-sm underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
        <nav aria-label="Site" className="contents">
          {COLUMNS.map((column) => (
            <div key={column.title} className="space-y-3">
              <p className="text-sm font-semibold">{column.title}</p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t">
        <p className="text-muted-foreground mx-auto max-w-6xl px-5 py-6 text-xs sm:px-8">
          Copyright © Jervil Angelo De Leon. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
