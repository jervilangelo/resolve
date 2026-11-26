/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { authConfig, sessionCookies } from '@/lib/auth';
import { exchangeCode } from '@/lib/cognito';
import { clearCookies, oauthStateSchema, unseal } from '@/lib/session';

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Completes sign-in: verifies state, exchanges the code with the PKCE verifier, sets cookies. */
export async function GET(request: NextRequest) {
  const { env, secure, names, cognito } = authConfig();
  const params = request.nextUrl.searchParams;
  const oauth = await unseal(
    request.cookies.get(names.oauth)?.value,
    oauthStateSchema,
    env.SESSION_SECRET,
  );
  const code = params.get('code');
  const state = params.get('state');
  const site = env.NEXT_PUBLIC_SITE_URL;

  // A callback that does not match the pending sign-in leaves that sign-in intact.
  if (!oauth || !code || !state || !sameState(state, oauth.state)) {
    return NextResponse.redirect(new URL('/auth/error', site));
  }

  try {
    const tokens = await exchangeCode(cognito, code, oauth.verifier);
    const response = NextResponse.redirect(new URL(oauth.returnTo, site));
    for (const cookie of await sessionCookies(tokens, null)) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    clearCookies(response.cookies, secure, names.oauth);
    return response;
  } catch {
    const response = NextResponse.redirect(new URL('/auth/error', site));
    clearCookies(response.cookies, secure, names.oauth);
    return response;
  }
}
