/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { createHash } from 'node:crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { z } from 'zod';

/**
 * Encrypted (A256GCM) cookie payloads. Tokens never reach browser JavaScript: cookies are
 * httpOnly and only the Next.js server decrypts them. The access and refresh tokens live in
 * separate cookies to stay under the 4 KB cookie limit, bound together by a session ID so one
 * cannot be resurrected without the other (e.g. by a refresh response arriving after sign-out).
 */
export const sessionSchema = z.object({
  sid: z.string(),
  accessToken: z.string(),
  /** Access token expiry, epoch seconds. */
  expiresAt: z.number(),
  email: z.string().nullable(),
});
export type Session = z.infer<typeof sessionSchema>;

export const refreshSchema = z.object({ sid: z.string(), refreshToken: z.string() });
export type RefreshCookie = z.infer<typeof refreshSchema>;

export const oauthStateSchema = z.object({
  state: z.string(),
  verifier: z.string(),
  returnTo: z.string(),
});
export type OAuthState = z.infer<typeof oauthStateSchema>;

function key(secret: string): Uint8Array {
  return createHash('sha256').update(secret).digest();
}

export async function seal(
  payload: Record<string, unknown>,
  secret: string,
  maxAgeSeconds: number,
) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${String(maxAgeSeconds)}s`)
    .encrypt(key(secret));
}

export async function unseal<T extends z.ZodType>(
  value: string | undefined,
  schema: T,
  secret: string,
): Promise<z.infer<T> | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtDecrypt(value, key(secret));
    const result = schema.safeParse(payload);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Post-login destinations must stay on this site (no open redirects). The value is resolved the
 * way browsers resolve it, so tricks like tabs or backslashes inside `//` cannot change the host.
 */
export function safeReturnTo(value: string | null | undefined, siteUrl: string): string {
  const fallback = '/dashboard';
  if (!value?.startsWith('/')) return fallback;
  try {
    const site = new URL(siteUrl);
    const target = new URL(value, site);
    const path = target.pathname + target.search + target.hash;
    // Normalisation can yield a path like `//host` (e.g. from `/.//host`), which a later URL
    // parse would treat as another host. (Backslashes are already normalised to slashes.)
    if (target.origin !== site.origin || path.startsWith('//')) {
      return fallback;
    }
    return path;
  } catch {
    return fallback;
  }
}

export interface CookieNames {
  session: string;
  refresh: string;
  oauth: string;
}

/** `__Host-` cookies require HTTPS; local development over http uses plain names. */
export function cookieNames(secure: boolean): CookieNames {
  const prefix = secure ? '__Host-' : '';
  return {
    session: `${prefix}rs_session`,
    refresh: `${prefix}rs_refresh`,
    oauth: `${prefix}rs_oauth`,
  };
}

export function cookieOptions(secure: boolean, maxAge: number) {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge };
}

interface CookieWriter {
  set(name: string, value: string, options: ReturnType<typeof cookieOptions>): unknown;
}

/**
 * Expires cookies with the same attributes they were set with. A plain delete omits `Secure`,
 * which browsers require to overwrite `__Host-` cookies, so the old cookie would survive.
 */
export function clearCookies(cookies: CookieWriter, secure: boolean, ...names: string[]) {
  for (const name of names) cookies.set(name, '', cookieOptions(secure, 0));
}

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
export const OAUTH_MAX_AGE = 10 * 60;
