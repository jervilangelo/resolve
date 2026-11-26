/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

/** The one public address for questions about Resolve. */
export const CONTACT_EMAIL = 'resolved.site@gmail.com';

export const REPOSITORY = 'jervilangelo/resolve';
export const RELEASES_URL = `https://github.com/${REPOSITORY}/releases`;

/**
 * The GCash (InstaPay QR Ph) code for voluntary donations, cropped from the owner's GCash QR with
 * its quiet zone kept. Set to null to show the Support page's placeholder instead.
 */
export const GCASH_QR: { src: string; width: number; height: number } | null = {
  src: '/support/gcash-qr.png',
  width: 526,
  height: 526,
};

export const PUBLIC_NAV = [
  { href: '/#features', label: 'Features' },
  { href: '/downloads', label: 'Download' },
  { href: '/tutorial', label: 'Tutorial' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
  { href: '/support', label: 'Support Resolve' },
] as const;
