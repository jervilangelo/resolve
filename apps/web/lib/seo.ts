/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import { publicEnv } from '@/lib/env';

export const SITE_NAME = 'Resolve';
/** The descriptive name used where it reads naturally (search results, profiles, structured data). */
export const PRODUCT_NAME = 'Resolve Browser Extension';
export const SITE_DESCRIPTION =
  'A free browser extension for healthier online habits. Block websites, blur explicit images on your device, start focus sessions, and opt into accountability.';

export const OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Resolve: a free browser extension for healthier online habits and voluntary accountability',
};

/**
 * The public, indexable pages, in the order the sitemap lists them. Anything signed-in or
 * one-off (dashboard, sign-in, invitations) stays out.
 */
export const PUBLIC_PATHS = [
  '/',
  '/downloads',
  '/tutorial',
  '/faq',
  '/about',
  '/support',
  '/privacy',
  '/terms',
] as const;
export type PublicPath = (typeof PUBLIC_PATHS)[number];

/** The one absolute form of a public URL, shared by canonicals, the sitemap and structured data. */
export function absoluteUrl(path: string): string {
  const url = new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL);
  // Next.js writes the home canonical without the trailing slash; match it everywhere.
  return path === '/' ? url.origin : url.toString();
}

/** Metadata for a public page: its own canonical URL and a matching social preview. */
export function pageMetadata({
  path,
  title,
  description,
  absoluteTitle = false,
}: {
  path: PublicPath;
  title: string;
  description: string;
  /** Use the title as-is instead of appending "· Resolve". */
  absoluteTitle?: boolean;
}): Metadata {
  const shareTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: shareTitle,
      description,
      url: absoluteUrl(path),
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
