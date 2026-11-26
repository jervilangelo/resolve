/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { SiteNav } from '@/components/site-nav';
import { isSignedIn } from '@/lib/auth';

export async function SiteHeader() {
  return <SiteNav signedIn={await isSignedIn()} />;
}
