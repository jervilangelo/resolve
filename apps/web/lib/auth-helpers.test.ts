/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { authorizeUrl, logoutUrl, pkceChallenge } from './cognito';
import { clearCookies, cookieNames, safeReturnTo, seal, sessionSchema, unseal } from './session';

const SECRET = 'x'.repeat(40);

describe('session cookies', () => {
  const session = { sid: 's1', accessToken: 'token', expiresAt: 123, email: 'a@example.com' };

  it('round-trips an encrypted session', async () => {
    const sealed = await seal(session, SECRET, 60);
    expect(sealed).not.toContain('token');
    expect(await unseal(sealed, sessionSchema, SECRET)).toEqual(session);
  });

  it('rejects tampered, foreign-key, expired and malformed values', async () => {
    const sealed = await seal(session, SECRET, 60);
    const tampered = `${sealed.slice(0, -4)}AAAA`;
    expect(await unseal(tampered, sessionSchema, SECRET)).toBeNull();
    expect(await unseal(sealed, sessionSchema, 'y'.repeat(40))).toBeNull();
    expect(await unseal(await seal(session, SECRET, -10), sessionSchema, SECRET)).toBeNull();
    expect(await unseal('not-a-jwe', sessionSchema, SECRET)).toBeNull();
    expect(await unseal(undefined, sessionSchema, SECRET)).toBeNull();
  });

  it('uses __Host- cookies only over HTTPS', () => {
    expect(cookieNames(true).session).toBe('__Host-rs_session');
    expect(cookieNames(false).session).toBe('rs_session');
  });
});

describe('safeReturnTo', () => {
  const site = 'http://localhost:3000';
  it.each([
    ['/dashboard/groups?x=1', '/dashboard/groups?x=1'],
    [null, '/dashboard'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    ['/\t/evil.example', '/dashboard'],
    ['/%09/evil.example', '/%09/evil.example'],
    ['/.//evil.example', '/dashboard'],
    ['/a/..//evil.example', '/dashboard'],
    ['dashboard', '/dashboard'],
  ])('%j -> %s', (input, expected) => {
    expect(safeReturnTo(input, site)).toBe(expected);
  });
});

describe('clearCookies', () => {
  it('expires cookies with the attributes they were set with', () => {
    const calls: unknown[] = [];
    clearCookies({ set: (...args: unknown[]) => calls.push(args) }, true, '__Host-rs_session');
    expect(calls).toEqual([
      [
        '__Host-rs_session',
        '',
        { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 },
      ],
    ]);
  });
});

describe('Cognito URLs', () => {
  const config = {
    domain: 'https://resolve.auth.example.com',
    clientId: 'client',
    redirectUri: 'http://localhost:3000/auth/callback',
  };

  it('computes the RFC 7636 S256 challenge', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('builds an authorization-code + PKCE request', () => {
    const url = new URL(authorizeUrl(config, 'state-1', 'verifier'));
    expect(url.origin + url.pathname).toBe('https://resolve.auth.example.com/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'client',
      redirect_uri: config.redirectUri,
      state: 'state-1',
      code_challenge_method: 'S256',
      code_challenge: pkceChallenge('verifier'),
    });
  });

  it('builds the logout redirect', () => {
    const url = new URL(logoutUrl(config, 'http://localhost:3000'));
    expect(url.pathname).toBe('/logout');
    expect(url.searchParams.get('logout_uri')).toBe('http://localhost:3000');
  });
});
