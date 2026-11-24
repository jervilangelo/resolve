/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authConfig, readSession, sessionCookies } from '@/lib/auth';
import { TokenError, refreshTokens } from '@/lib/cognito';
import { clearCookies } from '@/lib/session';

/** Refresh access tokens this many seconds before they expire. */
const REFRESH_MARGIN_SECONDS = 120;

/** Sends GET navigations to sign-in; optionally drops the session first. */
function toLogin(request: NextRequest, clear: boolean) {
  const { secure, names } = authConfig();
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Server-action POSTs continue to the action, which redirects to sign-in itself (a 307 here
    // would replay the POST against the GET-only login route). When the session is dropped, the
    // action must not see the old cookies either.
    if (!clear) return NextResponse.next();
    request.cookies.delete(names.session);
    request.cookies.delete(names.refresh);
    const response = NextResponse.next({ request: { headers: request.headers } });
    clearCookies(response.cookies, secure, names.session, names.refresh);
    return response;
  }
  const login = new URL('/auth/login', request.url);
  login.searchParams.set('returnTo', request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.redirect(login);
  if (clear) clearCookies(response.cookies, secure, names.session, names.refresh);
  return response;
}

/**
 * Guards the signed-in dashboard: requires a matching session/refresh cookie pair and refreshes
 * the access token shortly before expiry, so server components and actions see a valid one.
 */
export async function proxy(request: NextRequest) {
  const current = await readSession(request.cookies);
  if (!current) return toLogin(request, true);

  const now = Math.floor(Date.now() / 1000);
  const { session, refresh } = current;
  if (session.expiresAt - now > REFRESH_MARGIN_SECONDS) return NextResponse.next();

  try {
    const tokens = await refreshTokens(authConfig().cognito, refresh.refreshToken);
    const cookies = await sessionCookies(tokens, session.email, refresh.sid);
    // Expose the new cookies to this request's server components, and persist them.
    for (const cookie of cookies) request.cookies.set(cookie.name, cookie.value);
    const response = NextResponse.next({ request: { headers: request.headers } });
    for (const cookie of cookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    const rejected = error instanceof TokenError && error.rejected;
    // A transient Cognito failure must not sign the user out while the token still works.
    if (!rejected && session.expiresAt > now) return NextResponse.next();
    return toLogin(request, rejected);
  }
}

export const config = { matcher: ['/dashboard/:path*'] };
