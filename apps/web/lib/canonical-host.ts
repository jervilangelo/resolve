/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

/**
 * The dashboard answers on one address (NEXT_PUBLIC_SITE_URL), because sign-in cookies are tied
 * to the host they were set on. Requests to a known alternate host (www., or the hosting
 * provider's own *.amplifyapp.com address) are sent to the same path there. Any other host is
 * left alone, so an unexpected internal host can never cause a redirect loop.
 *
 * Returns the URL to redirect to, or null to serve the request as is.
 */
export function canonicalRedirect(
  requestUrl: URL,
  host: string | null,
  siteUrl: string,
): URL | null {
  if (!host) return null;
  const site = new URL(siteUrl);
  if (site.protocol !== 'https:') return null; // local development
  const requested = host.toLowerCase().split(':')[0] ?? '';
  const canonical = site.hostname.toLowerCase();
  if (requested === canonical) return null;
  const alternate = requested === `www.${canonical}` || requested.endsWith('.amplifyapp.com');
  if (!alternate) return null;
  // The canonical address must itself not be an amplifyapp host (domain not switched yet).
  if (canonical.endsWith('.amplifyapp.com')) return null;
  return new URL(requestUrl.pathname + requestUrl.search, site.origin);
}
