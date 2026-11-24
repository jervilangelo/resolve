/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';
import type { ExtensionConfig } from './config';
import type { PrivateStore } from './private-store';

/**
 * Cognito sign-in for the extension: authorization code + PKCE through the browser identity API.
 * Tokens are held only by the background worker, in origin-private storage (see private-store.ts);
 * extension pages receive account status, never tokens.
 *
 * The session record also holds the installation's active group, so signing out removes both in
 * one step. Every check-then-write on it is a single atomic update keyed by the session ID (`sid`),
 * so work started by an earlier sign-in can never write into a later one.
 */

const SESSION_KEY = 'session';
const PENDING_REVOCATIONS_KEY = 'pendingRevocations';
const REFRESH_MARGIN_SECONDS = 120;
/** Cognito refresh tokens live 30 days; an unrevoked one is useless after that. */
const REVOCATION_RETRY_SECONDS = 30 * 24 * 60 * 60;

const sessionSchema = z.object({
  sid: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  email: z.string().nullable(),
  activeGroupId: z.string().nullable().optional(),
});
export type ExtensionSession = z.infer<typeof sessionSchema>;

const pendingSchema = z.array(z.object({ token: z.string(), until: z.number() }));

const tokenResponseSchema = z.object({
  access_token: z.string(),
  id_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
});
type TokenResponse = z.infer<typeof tokenResponseSchema>;

/** The token endpoint was unreachable or failing; the session is kept and may recover. */
export class TransientAuthError extends Error {
  constructor() {
    super('Sign-in service temporarily unavailable');
    this.name = 'TransientAuthError';
  }
}

class RejectedGrantError extends Error {}

/** Minimal surface of the browser APIs used, so the flow can be unit tested. */
export interface AuthPlatform {
  launchWebAuthFlow(url: string): Promise<string | undefined>;
  redirectUrl(): string;
  store: PrivateStore;
  fetch: typeof fetch;
  now(): number;
  random(bytes: number): Uint8Array;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Reads the email claim of an ID token received directly from Cognito over TLS (display only). */
function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split('.')[1];
  if (!payload) return null;
  try {
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const email = z.object({ email: z.string() }).safeParse(json);
    return email.success ? email.data.email : null;
  } catch {
    return null;
  }
}

const parseSession = (value: unknown) => {
  const result = sessionSchema.safeParse(value);
  return result.success ? result.data : null;
};

export function createAuth(config: ExtensionConfig, platform: AuthPlatform) {
  const { store } = platform;
  let refreshing: Promise<string> | null = null;
  const seconds = () => Math.floor(platform.now() / 1000);

  async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
    let res: Response;
    try {
      res = await platform.fetch(new URL('/oauth2/token', config.cognitoDomain), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: config.clientId, ...body }),
      });
    } catch {
      throw new TransientAuthError();
    }
    // 400/401 are definitive OAuth errors (invalid_grant, etc.); anything else may recover.
    if (res.status === 400 || res.status === 401) throw new RejectedGrantError();
    if (!res.ok) throw new TransientAuthError();
    return tokenResponseSchema.parse(await res.json());
  }

  const load = async () => parseSession(await store.get(SESSION_KEY));

  /** Applies `change` only if the stored session still has `sid`; returns the stored result. */
  async function updateIfSid(
    sid: string,
    change: (s: ExtensionSession) => ExtensionSession | undefined,
  ) {
    let applied = false;
    const written = await store.update(SESSION_KEY, (raw) => {
      const current = parseSession(raw);
      if (current?.sid !== sid) return raw;
      applied = true;
      return change(current);
    });
    return { applied, session: parseSession(written) };
  }

  async function refresh(session: ExtensionSession): Promise<string> {
    const tokens = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    });
    const { applied, session: next } = await updateIfSid(session.sid, (current) => ({
      ...current,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? current.refreshToken,
      expiresAt: seconds() + tokens.expires_in,
      email: emailFromIdToken(tokens.id_token) ?? current.email,
    }));
    // Signed out (or in again) while the request was in flight: the result is discarded.
    if (!applied || !next) throw new RejectedGrantError();
    return next.accessToken;
  }

  async function revoke(token: string): Promise<boolean> {
    try {
      const res = await platform.fetch(new URL('/oauth2/revoke', config.cognitoDomain), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: config.clientId, token }),
      });
      // 400 means the token is already invalid, which is the goal.
      return res.ok || res.status === 400;
    } catch {
      return false;
    }
  }

  const unexpired = (value: unknown) => {
    const result = pendingSchema.safeParse(value);
    return result.success ? result.data.filter((p) => p.until > seconds()) : [];
  };

  return {
    async signIn(): Promise<ExtensionSession> {
      const state = base64url(platform.random(32));
      const verifier = base64url(platform.random(48));
      const redirectUri = platform.redirectUrl();
      const authorize = new URL('/oauth2/authorize', config.cognitoDomain);
      authorize.search = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        state,
        code_challenge: await pkceChallenge(verifier),
        code_challenge_method: 'S256',
        // Always show the sign-in form, so signing out really allows switching accounts.
        prompt: 'login',
      }).toString();

      const returned = await platform.launchWebAuthFlow(authorize.toString());
      if (!returned?.startsWith(redirectUri)) throw new Error('Sign-in was cancelled');
      const params = new URL(returned).searchParams;
      if (params.get('state') !== state) throw new Error('Sign-in state mismatch');
      const code = params.get('code');
      if (!code) throw new Error('Sign-in returned no code');

      const tokens = await tokenRequest({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      });
      if (!tokens.refresh_token) throw new Error('No refresh token');
      const session: ExtensionSession = {
        sid: base64url(platform.random(16)),
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: seconds() + tokens.expires_in,
        email: emailFromIdToken(tokens.id_token),
        activeGroupId: null,
      };
      await store.set(SESSION_KEY, session);
      return session;
    },

    /**
     * A valid access token for the current session, refreshing shortly before expiry (one refresh
     * at a time); null when signed out. Throws TransientAuthError when the token has expired and
     * Cognito is unreachable.
     */
    async accessToken(): Promise<{ token: string; sid: string } | null> {
      const session = await load();
      if (!session) return null;
      if (session.expiresAt - seconds() > REFRESH_MARGIN_SECONDS) {
        return { token: session.accessToken, sid: session.sid };
      }
      refreshing ??= refresh(session).finally(() => {
        refreshing = null;
      });
      try {
        return { token: await refreshing, sid: session.sid };
      } catch (error) {
        if (error instanceof RejectedGrantError) {
          // Revoked/expired refresh token, or a sign-out raced the refresh: signed out.
          await updateIfSid(session.sid, () => undefined);
          return null;
        }
        if (session.expiresAt > seconds()) return { token: session.accessToken, sid: session.sid };
        throw new TransientAuthError();
      }
    },

    async session(): Promise<ExtensionSession | null> {
      return load();
    },

    /** Sets the active group only if `sid` is still the current sign-in. */
    async setActiveGroup(sid: string, groupId: string | null): Promise<boolean> {
      return (await updateIfSid(sid, (current) => ({ ...current, activeGroupId: groupId })))
        .applied;
    },

    async revocationPending(): Promise<boolean> {
      return unexpired(await store.get(PENDING_REVOCATIONS_KEY)).length > 0;
    },

    /**
     * Signs out locally at once (session and active group together), then revokes the refresh
     * token at Cognito. With `onlySid`, signs out only if that sign-in is still current (so a late
     * 401 from an old session cannot end a newer one). An unconfirmed revocation is retried later.
     */
    async signOut(onlySid?: string): Promise<void> {
      let removed: ExtensionSession | null = null;
      await store.update(SESSION_KEY, (raw) => {
        const current = parseSession(raw);
        if (onlySid && current?.sid !== onlySid) return raw;
        removed = current;
        return undefined;
      });
      const ended = removed as ExtensionSession | null;
      if (ended && !(await revoke(ended.refreshToken))) {
        const item = { token: ended.refreshToken, until: seconds() + REVOCATION_RETRY_SECONDS };
        await store.update(PENDING_REVOCATIONS_KEY, (raw) => [...unexpired(raw), item]);
      }
    },

    /** Retries revocations that could not be confirmed earlier. */
    async flushRevocations(): Promise<void> {
      const queue = unexpired(await store.get(PENDING_REVOCATIONS_KEY));
      if (queue.length === 0) return;
      const done = new Set<string>();
      for (const item of queue) if (await revoke(item.token)) done.add(item.token);
      // Merge with entries queued meanwhile instead of overwriting them.
      await store.update(PENDING_REVOCATIONS_KEY, (raw) => {
        const remaining = unexpired(raw).filter((p) => !done.has(p.token));
        return remaining.length > 0 ? remaining : undefined;
      });
    },
  };
}

export type Auth = ReturnType<typeof createAuth>;
