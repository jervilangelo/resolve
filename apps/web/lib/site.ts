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
 * The GCash QR code for voluntary donations. Until it is provided this stays null and the
 * Support page shows a placeholder; to publish it, add the image under public/support/ and set
 * e.g. `{ src: '/support/gcash-qr.png', width: 600, height: 600 }`.
 */
export const GCASH_QR: { src: string; width: number; height: number } | null = null;

export const PUBLIC_NAV = [
  { href: '/#features', label: 'Features' },
  { href: '/downloads', label: 'Download' },
  { href: '/tutorial', label: 'Tutorial' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
  { href: '/support', label: 'Support Resolve' },
] as const;
