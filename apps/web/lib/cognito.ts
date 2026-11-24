/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { createHash, randomBytes } from 'node:crypto';
import { decodeJwt } from 'jose';
import { z } from 'zod';

export interface CognitoConfig {
  domain: string;
  clientId: string;
  redirectUri: string;
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  id_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** PKCE S256 challenge for a verifier (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function authorizeUrl(config: CognitoConfig, state: string, verifier: string): string {
  const url = new URL('/oauth2/authorize', config.domain);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'openid email profile',
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

export function logoutUrl(config: CognitoConfig, logoutUri: string): string {
  const url = new URL('/logout', config.domain);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: logoutUri,
  }).toString();
  return url.toString();
}

/** `rejected` means Cognito refused the grant (e.g. revoked or expired refresh token). */
export class TokenError extends Error {
  constructor(readonly rejected: boolean) {
    super(rejected ? 'Token grant rejected' : 'Token endpoint unavailable');
    this.name = 'TokenError';
  }
}

async function tokenRequest(config: CognitoConfig, body: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(new URL('/oauth2/token', config.domain), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, ...body }),
      cache: 'no-store',
    });
  } catch {
    throw new TokenError(false);
  }
  // 400/401 are definitive OAuth errors (invalid_grant etc.); anything else may be transient.
  if (!res.ok) throw new TokenError(res.status === 400 || res.status === 401);
  return tokenResponseSchema.parse(await res.json());
}

export const exchangeCode = (config: CognitoConfig, code: string, verifier: string) =>
  tokenRequest(config, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });

export const refreshTokens = (config: CognitoConfig, refreshToken: string) =>
  tokenRequest(config, { grant_type: 'refresh_token', refresh_token: refreshToken });

/** Best effort: invalidates the refresh token and the access tokens issued from it. */
export async function revokeRefreshToken(config: CognitoConfig, refreshToken: string) {
  await fetch(new URL('/oauth2/revoke', config.domain), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, token: refreshToken }),
    cache: 'no-store',
  }).catch(() => undefined);
}

/**
 * Reads the email claim of an ID token received directly from the Cognito token endpoint over
 * TLS (OIDC Core 3.1.3.7 permits skipping signature validation for tokens obtained this way).
 * Used only for display; authorization always relies on the API validating the access token.
 */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const email = decodeJwt(idToken).email;
  return typeof email === 'string' ? email : null;
}
