/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth';
import { revokeRefreshToken } from '@/lib/cognito';
import { clearCookies, refreshSchema, unseal } from '@/lib/session';

/**
 * Signs out: revokes the refresh token and clears the session cookies, then continues to a
 * same-site page that ends the Cognito managed login session. POST only, and only from this
 * site, so other sites cannot force a sign-out.
 */
export async function POST(request: NextRequest) {
  const { env, secure, names, cognito } = authConfig();
  const site = new URL(env.NEXT_PUBLIC_SITE_URL);
  if (request.headers.get('origin') !== site.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const refresh = await unseal(
    request.cookies.get(names.refresh)?.value,
    refreshSchema,
    env.SESSION_SECRET,
  );
  if (refresh) await revokeRefreshToken(cognito, refresh.refreshToken);

  const response = NextResponse.redirect(new URL('/auth/signed-out', site), 303);
  clearCookies(response.cookies, secure, names.session, names.refresh);
  return response;
}
