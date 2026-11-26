/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { BOOT_SCRIPT, BootScreen } from '@/components/boot-screen';
import { PublicOnly } from '@/components/public-only';
import { Toaster } from '@/components/ui/toaster';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { publicEnv } from '@/lib/env';

const description = 'Free browser protection and voluntary accountability for Christians.';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: 'Resolve — Take every thought captive.', template: '%s · Resolve' },
  description,
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Resolve',
    description,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Resolve' }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <BootScreen />
        <a
          href="#main"
          className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Toaster>
          <PublicOnly>
            <SiteHeader />
          </PublicOnly>
          <main id="main" className="flex-1">
            {children}
          </main>
          <PublicOnly>
            <SiteFooter />
          </PublicOnly>
        </Toaster>
      </body>
    </html>
  );
}
