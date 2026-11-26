/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { CognitoConfig, TokenResponse } from './cognito';
import { emailFromIdToken } from './cognito';
import { serverEnv } from './server-env';
import {
  type RefreshCookie,
  SESSION_MAX_AGE,
  type Session,
  cookieNames,
  cookieOptions,
  refreshSchema,
  seal,
  sessionSchema,
  unseal,
} from './session';

export function authConfig() {
  const env = serverEnv();
  const secure = env.NEXT_PUBLIC_SITE_URL.startsWith('https://');
  const cognito: CognitoConfig = {
    domain: env.COGNITO_DOMAIN,
    clientId: env.COGNITO_CLIENT_ID,
    redirectUri: new URL('/auth/callback', env.NEXT_PUBLIC_SITE_URL).toString(),
  };
  return { env, secure, names: cookieNames(secure), cognito };
}

/**
 * Encrypted cookies for a token response. `sid` continues an existing session on refresh; a new
 * sign-in gets a fresh one. The refresh cookie is only rewritten when Cognito issues a new token.
 */
export async function sessionCookies(tokens: TokenResponse, email: string | null, sid?: string) {
  const { env, secure, names } = authConfig();
  const sessionId = sid ?? randomBytes(16).toString('base64url');
  const session: Session = {
    sid: sessionId,
    accessToken: tokens.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    email: emailFromIdToken(tokens.id_token) ?? email,
  };
  const options = cookieOptions(secure, SESSION_MAX_AGE);
  const result = [
    {
      name: names.session,
      value: await seal(session, env.SESSION_SECRET, SESSION_MAX_AGE),
      options,
    },
  ];
  if (tokens.refresh_token) {
    const refresh: RefreshCookie = { sid: sessionId, refreshToken: tokens.refresh_token };
    result.push({
      name: names.refresh,
      value: await seal(refresh, env.SESSION_SECRET, SESSION_MAX_AGE),
      options,
    });
  }
  return result;
}

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/** Both halves of the session, or null unless both exist and belong to the same session. */
export async function readSession(store: CookieReader) {
  const { env, names } = authConfig();
  const [session, refresh] = await Promise.all([
    unseal(store.get(names.session)?.value, sessionSchema, env.SESSION_SECRET),
    unseal(store.get(names.refresh)?.value, refreshSchema, env.SESSION_SECRET),
  ]);
  if (!session || !refresh) return null;
  return session.sid === refresh.sid ? { session, refresh } : null;
}

/**
 * Whether the visitor is signed in, for public chrome such as the site header. Without a session
 * cookie it never touches server configuration, and any failure counts as signed out, so public
 * pages render even where authentication is not configured.
 */
export async function isSignedIn(): Promise<boolean> {
  const jar = await cookies();
  if (!['rs_session', '__Host-rs_session'].some((name) => jar.has(name))) return false;
  try {
    return (await getSession()) !== null;
  } catch {
    return false;
  }
}

/** The current session for server components and actions (refreshed by proxy.ts). */
export async function getSession(): Promise<Session | null> {
  return (await readSession(await cookies()))?.session ?? null;
}
