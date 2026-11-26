/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth';
import { authorizeUrl, randomToken } from '@/lib/cognito';
import { OAUTH_MAX_AGE, type OAuthState, cookieOptions, safeReturnTo, seal } from '@/lib/session';

/** Starts the authorization-code + PKCE flow with Cognito managed login. */
export async function GET(request: NextRequest) {
  const { env, secure, names, cognito } = authConfig();
  const oauth: OAuthState = {
    state: randomToken(),
    verifier: randomToken(48),
    returnTo: safeReturnTo(request.nextUrl.searchParams.get('returnTo'), env.NEXT_PUBLIC_SITE_URL),
  };
  const response = NextResponse.redirect(authorizeUrl(cognito, oauth.state, oauth.verifier));
  response.cookies.set(
    names.oauth,
    await seal(oauth, env.SESSION_SECRET, OAUTH_MAX_AGE),
    cookieOptions(secure, OAUTH_MAX_AGE),
  );
  return response;
}
