/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { installationRemovedRequestSchema } from '@resolve/contracts';
import { type NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/lib/server-env';

/**
 * Relays an uninstall-URL token to the API (docs/MASTER_PLAN.md §7.4). The token reached the
 * browser in the URL fragment, so it never appears in an access log; it is not logged here
 * either. Every outcome gets the same answer.
 */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  // Only this site's own page may relay (the token is the real credential; this keeps others out).
  if (request.headers.get('origin') !== request.nextUrl.origin) return done;
  const parsed = installationRemovedRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return done;
  try {
    await fetch(new URL('/v1/installations/removed', serverEnv().RESOLVE_API_URL), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Unreachable or not configured: the inactivity check covers this browser later.
  }
  return done;
}
