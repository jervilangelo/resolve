/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { MetadataRoute } from 'next';
import { PUBLIC_PATHS, absoluteUrl } from '@/lib/seo';

/** Only the canonical public pages; the dashboard, sign-in and invitations are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({ url: absoluteUrl(path) }));
}
