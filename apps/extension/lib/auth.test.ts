/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { createAccount } from './account';
import { type AuthPlatform, createAuth, pkceChallenge } from './auth';
import type { ExtensionConfig } from './config';
import { isExtensionPage, parseRequest } from './messages';

const config: ExtensionConfig = {
  apiUrl: 'https://api.example.com',
  cognitoDomain: 'https://auth.example.com',
  clientId: 'ext-client',
  dashboardUrl: 'http://localhost:3000',
};
const REDIRECT = 'https://abc.chromiumapp.org/';
const GROUP_A = 'grp_aaaaaaaaaaaaaaaaaaaaaaaaaa';
const GROUP_B = 'grp_bbbbbbbbbbbbbbbbbbbbbbbbbb';

function idToken(email: string) {
  const payload = btoa(JSON.stringify({ email })).replace(/=+$/, '');
  return `e30.${payload}.sig`;
}

function fakePlatform(
  options: {
    tokenStatus?: number;
    revokeStatus?: number;
    returnUrl?: (authorize: URL) => string;
  } = {},
) {
  const store = new Map<string, unknown>();
  const requests: { url: string; body: string; auth: string | null }[] = [];
  let clock = 1_000_000_000_000;
  let seed = 0;
  let groups = [
    { groupId: GROUP_A, name: 'A', role: 'ADMIN', createdAt: '2026-11-24T00:00:00.000Z' },
  ];
  const platform: AuthPlatform = {
    launchWebAuthFlow: (url) => {
      const authorize = new URL(url);
      const back =
        options.returnUrl?.(authorize) ??
        `${REDIRECT}?code=abc&state=${authorize.searchParams.get('state') ?? ''}`;
      return Promise.resolve(back);
    },
    redirectUrl: () => REDIRECT,
    store: {
      get: (key: string) => Promise.resolve(store.get(key)),
      set: (key: string, value: unknown) => {
        store.set(key, value);
        return Promise.resolve();
      },
      remove: (key: string) => {
        store.delete(key);
        return Promise.resolve();
      },
      update: (key: string, change: (current: unknown) => unknown) => {
        const next = change(store.get(key));
        if (next === undefined) store.delete(key);
        else store.set(key, next);
        return Promise.resolve(next);
      },
    },
    fetch: (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const headers = new Headers(init?.headers);
      requests.push({
        url,
        body: init?.body instanceof URLSearchParams ? init.body.toString() : '',
        auth: headers.get('authorization'),
      });
      if (url.endsWith('/oauth2/token')) {
        const status = options.tokenStatus ?? 200;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: `at-${String(requests.length)}`,
              id_token: idToken('a@example.com'),
              refresh_token: 'rt-1',
              expires_in: 3600,
            }),
            { status },
          ),
        );
      }
      if (url.endsWith('/oauth2/revoke')) {
        return Promise.resolve(new Response(null, { status: options.revokeStatus ?? 200 }));
      }
      const path = new URL(url).pathname;
      if (path === '/v1/groups') {
        return Promise.resolve(Response.json({ items: groups, nextCursor: null }));
      }
      const group = groups.find((g) => path === `/v1/groups/${g.groupId}`);
      return Promise.resolve(group ? Response.json(group) : new Response('{}', { status: 404 }));
    },
    now: () => clock,
    random: (bytes) => new Uint8Array(bytes).fill((seed = (seed + 1) % 256)),
  };
  return {
    platform,
    store,
    requests,
    advance: (ms: number) => {
      clock += ms;
    },
    setGroups: (next: typeof groups) => {
      groups = next;
    },
  };
}

describe('extension sign-in', () => {
  it('uses authorization code + PKCE and keeps tokens in extension storage', async () => {
    const fake = fakePlatform();
    const auth = createAuth(config, fake.platform);
    let authorize: URL | undefined;
    fake.platform.launchWebAuthFlow = (url) => {
      authorize = new URL(url);
      return Promise.resolve(
        `${REDIRECT}?code=abc&state=${authorize.searchParams.get('state') ?? ''}`,
      );
    };
    const session = await auth.signIn();
    expect(authorize?.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorize?.searchParams.get('prompt')).toBe('login');
    expect(authorize?.searchParams.get('redirect_uri')).toBe(REDIRECT);
    const tokenBody = new URLSearchParams(fake.requests[0]?.body);
    expect(tokenBody.get('grant_type')).toBe('authorization_code');
    expect(await pkceChallenge(tokenBody.get('code_verifier') ?? '')).toBe(
      authorize?.searchParams.get('code_challenge'),
    );
    expect(session.email).toBe('a@example.com');
    expect(await auth.session()).toMatchObject({ email: 'a@example.com', activeGroupId: null });
    expect(await auth.revocationPending()).toBe(false);
  });

  it('rejects a mismatched state and a cancelled flow', async () => {
    const mismatched = fakePlatform({ returnUrl: () => `${REDIRECT}?code=abc&state=forged` });
    await expect(createAuth(config, mismatched.platform).signIn()).rejects.toThrow('state');
    const cancelled = fakePlatform({ returnUrl: () => 'https://elsewhere.example/' });
    await expect(createAuth(config, cancelled.platform).signIn()).rejects.toThrow('cancelled');
    expect(mismatched.store.size + cancelled.store.size).toBe(0);
  });

  it('refreshes near expiry and signs out only when Cognito rejects the refresh token', async () => {
    const fake = fakePlatform();
    const auth = createAuth(config, fake.platform);
    await auth.signIn();
    expect(await auth.accessToken()).toMatchObject({ token: 'at-1' });
    fake.advance(3_500_000);
    expect(await auth.accessToken()).toMatchObject({ token: 'at-2' });

    const outage = fakePlatform({ tokenStatus: 503 });
    const flaky = createAuth(config, outage.platform);
    outage.store.set('session', {
      accessToken: 'old',
      sid: 's1',
      refreshToken: 'rt',
      expiresAt: 1_000_000_060,
      email: null,
    });
    expect(await flaky.accessToken()).toMatchObject({ token: 'old' });

    const revoked = fakePlatform({ tokenStatus: 400 });
    const gone = createAuth(config, revoked.platform);
    revoked.store.set('session', {
      accessToken: 'old',
      sid: 's1',
      refreshToken: 'rt',
      expiresAt: 1_000_000_060,
      email: null,
    });
    expect(await gone.accessToken()).toBeNull();
    expect(revoked.store.has('session')).toBe(false);
  });
});

describe('active group', () => {
  it('sets a verified group and clears it once the user is no longer a member', async () => {
    const fake = fakePlatform();
    const auth = createAuth(config, fake.platform);
    const account = createAccount(config, auth, { fetch: fake.platform.fetch });
    await auth.signIn();
    const set = await account.setActiveGroup(GROUP_A);
    expect(set).toMatchObject({ state: 'signedIn', activeGroupId: GROUP_A });
    expect(fake.requests.at(-2)?.auth).toMatch(/^Bearer at-/);

    expect(await account.setActiveGroup(GROUP_B)).toMatchObject({
      activeGroupId: GROUP_A,
      error: 'That group is no longer available.',
    });

    fake.setGroups([]);
    expect(await account.state()).toMatchObject({ activeGroupId: null, groups: [] });
  });

  it('selects the only group automatically, but respects a choice of none', async () => {
    const fake = fakePlatform();
    const auth = createAuth(config, fake.platform);
    const account = createAccount(config, auth, { fetch: fake.platform.fetch });
    await auth.signIn();
    expect(await account.state()).toMatchObject({ state: 'signedIn', activeGroupId: GROUP_A });

    expect(await account.setActiveGroup(null)).toMatchObject({ activeGroupId: null });
    expect(await account.state()).toMatchObject({ activeGroupId: null });

    // With two groups the user picks; nothing is selected for them.
    const two = fakePlatform();
    const auth2 = createAuth(config, two.platform);
    const account2 = createAccount(config, auth2, { fetch: two.platform.fetch });
    two.setGroups([
      { groupId: GROUP_A, name: 'A', role: 'ADMIN', createdAt: '2026-11-24T00:00:00.000Z' },
      { groupId: GROUP_B, name: 'B', role: 'MEMBER', createdAt: '2026-11-24T00:00:00.000Z' },
    ]);
    await auth2.signIn();
    expect(await account2.state()).toMatchObject({ activeGroupId: null });
  });

  it('auto-selects again after a manual choice, a removal or an interrupted sign-out', async () => {
    const fake = fakePlatform();
    const auth = createAuth(config, fake.platform);
    const account = createAccount(config, auth, { fetch: fake.platform.fetch });
    const session = await auth.signIn();
    // None, then a group again: the "none" choice is forgotten.
    await account.setActiveGroup(null);
    await account.setActiveGroup(GROUP_A);
    expect((await auth.session())?.noGroupChosen).toBe(false);

    // Removed from A, still in B only: B is protected automatically.
    fake.setGroups([
      { groupId: GROUP_B, name: 'B', role: 'MEMBER', createdAt: '2026-11-24T00:00:00.000Z' },
    ]);
    expect(await account.state()).toMatchObject({ activeGroupId: GROUP_B });

    // A sign-out that stopped after clearing the group does not count as choosing none.
    await auth.setActiveGroup(session.sid, null, { byUser: false });
    expect(await account.state()).toMatchObject({ activeGroupId: GROUP_B });
  });

  it('keeps the group list when the auto-select check fails, and selects from background sync', async () => {
    const fake = fakePlatform();
    const auth = createAuth(config, fake.platform);
    let failCheck = true;
    const fetch: typeof fake.platform.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (failCheck && new URL(url).pathname === `/v1/groups/${GROUP_A}`) {
        return Promise.resolve(new Response('{}', { status: 503 }));
      }
      return fake.platform.fetch(input, init);
    };
    const account = createAccount(config, auth, { fetch });
    await auth.signIn();
    const shown = await account.state();
    expect(shown).toMatchObject({ groupsLoaded: true, activeGroupId: null });
    expect(shown).not.toHaveProperty('error');

    failCheck = false;
    await account.syncActive();
    expect((await auth.session())?.activeGroupId).toBe(GROUP_A);
  });

  it('forgets the active group on sign-out', async () => {
    const fake = fakePlatform();
    const auth = createAuth(config, fake.platform);
    const account = createAccount(config, auth, { fetch: fake.platform.fetch });
    await auth.signIn();
    await account.setActiveGroup(GROUP_A);
    expect(await account.signOut()).toEqual({ state: 'signedOut' });
    expect(fake.store.size).toBe(0);
    expect(fake.requests.some((r) => r.url.endsWith('/oauth2/revoke'))).toBe(true);
  });
});

describe('message guard', () => {
  it('answers extension pages only', () => {
    const origin = 'chrome-extension://abc/';
    expect(isExtensionPage('chrome-extension://abc/popup.html', origin)).toBe(true);
    expect(isExtensionPage('https://evil.example/', origin)).toBe(false);
    expect(isExtensionPage('chrome-extension://other/popup.html', origin)).toBe(false);
    expect(isExtensionPage(undefined, origin)).toBe(false);
  });

  it('validates active-group requests', () => {
    expect(parseRequest({ type: 'group/setActive', groupId: GROUP_A })).not.toBeNull();
    expect(parseRequest({ type: 'group/setActive', groupId: 'grp_../x' })).toBeNull();
    expect(parseRequest({ type: 'account/signIn', token: 'x' })).toBeNull();
  });
});

describe('review regressions', () => {
  it('discards a refresh that completes after sign-out', async () => {
    const fake = fakePlatform();
    const auth = createAuth(config, fake.platform);
    await auth.signIn();
    fake.advance(3_500_000);
    const realFetch = fake.platform.fetch;
    let release: () => void = () => undefined;
    fake.platform.fetch = async (input, init) => {
      if (
        (input instanceof URL
          ? input.href
          : typeof input === 'string'
            ? input
            : input.url
        ).endsWith('/oauth2/token')
      ) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return realFetch(input, init);
    };
    const pending = auth.accessToken();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await auth.signOut();
    release();
    expect(await pending).toBeNull();
    expect(await auth.session()).toBeNull();
  });

  it('reports an outage instead of signing out when the token expired', async () => {
    const fake = fakePlatform({ tokenStatus: 503 });
    const auth = createAuth(config, fake.platform);
    const account = createAccount(config, auth, { fetch: fake.platform.fetch });
    fake.store.set('session', {
      sid: 's1',
      accessToken: 'old',
      refreshToken: 'rt',
      expiresAt: 999_999_000,
      email: 'a@example.com',
    });
    expect(await account.state()).toMatchObject({
      state: 'signedIn',
      error: expect.stringContaining('Could not reach Resolve') as unknown,
    });
    expect(fake.store.has('session')).toBe(true);
  });

  it('queues a revocation that could not be confirmed and retries it later', async () => {
    const fake = fakePlatform({ revokeStatus: 503 });
    const auth = createAuth(config, fake.platform);
    const account = createAccount(config, auth, { fetch: fake.platform.fetch });
    await auth.signIn();
    expect(await account.signOut()).toMatchObject({
      state: 'signedOut',
      error: expect.stringContaining('fully revoked') as unknown,
    });
    fake.store.set('pendingRevocations', fake.store.get('pendingRevocations'));
    const retried = createAuth(config, { ...fake.platform, fetch: fakePlatform().platform.fetch });
    await retried.flushRevocations();
    expect(fake.store.has('pendingRevocations')).toBe(false);
  });

  it('keeps a newer sign-in when a late 401 arrives for an older one', async () => {
    const fake = fakePlatform();
    const auth = createAuth(config, fake.platform);
    const first = await auth.signIn();
    await auth.signOut();
    const second = await auth.signIn();
    await auth.signOut(first.sid);
    expect((await auth.session())?.sid).toBe(second.sid);
  });

  it('does not claim "no groups" while offline', async () => {
    const fake = fakePlatform();
    const auth = createAuth(config, fake.platform);
    await auth.signIn();
    const account = createAccount(config, auth, {
      fetch: () => Promise.reject(new Error('offline')),
    });
    expect(await account.state()).toMatchObject({ state: 'signedIn', groupsLoaded: false });
  });
});
