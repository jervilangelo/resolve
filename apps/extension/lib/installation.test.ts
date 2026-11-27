/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { createInstallation } from './installation';
import type { PrivateStore } from './private-store';

const DASHBOARD = 'https://getresolved.site';
const GROUP_A = 'grp_aaaaaaaaaaaaaaaaaaaaaaaaaa';
const GROUP_B = 'grp_bbbbbbbbbbbbbbbbbbbbbbbbbb';

function fakeStore(): PrivateStore {
  const data = new Map<string, unknown>();
  return {
    get: (k) => Promise.resolve(data.get(k)),
    set: (k, v) => {
      data.set(k, v);
      return Promise.resolve();
    },
    remove: (k) => {
      data.delete(k);
      return Promise.resolve();
    },
    update: (k, change) => {
      const next = change(data.get(k));
      if (next === undefined) data.delete(k);
      else data.set(k, next);
      return Promise.resolve(next);
    },
  };
}

function setup() {
  let session: { sid: string; activeGroupId: string | null } | null = {
    sid: 'sid-1',
    activeGroupId: GROUP_A,
  };
  let online = true;
  /** 'commit-then-lose' stores the enrolment but loses the reply; 'reject' refuses it. */
  let mode: 'normal' | 'commit-then-lose' | 'reject' = 'normal';
  let seed = 0;
  let clock = 1_000;
  /** The server's view: active installations by ID, with their token. */
  const server = new Map<string, { token: string; groupId: string }>();
  const calls: string[] = [];
  const urls: string[] = [];
  const installation = createInstallation({
    store: fakeStore(),
    session: () => Promise.resolve(session),
    authed: (_method, path, body, sid) => {
      calls.push(path);
      if (!online) return Promise.resolve('offline');
      if (session?.sid !== sid) return Promise.resolve('signedOut');
      if (path === '/v1/extension/installations') {
        const { groupId, installationId, token } = body as {
          groupId: string;
          installationId: string;
          token: string;
        };
        if (mode === 'reject') return Promise.resolve({ status: 404, json: null });
        const existing = server.get(installationId);
        if (existing && existing.token !== token)
          return Promise.resolve({ status: 409, json: null });
        server.set(installationId, { token, groupId });
        if (mode === 'commit-then-lose') return Promise.resolve('offline');
        return Promise.resolve({ status: 201, json: { installationId, token } });
      }
      const id = /installations\/(ins_\w+)\/checkin/.exec(path)?.[1] ?? '';
      return Promise.resolve({ status: server.has(id) ? 204 : 404, json: null });
    },
    post: (path, body) => {
      calls.push(path);
      if (!online) return Promise.resolve(false);
      const { token } = body as { token: string };
      for (const [id, inst] of server) if (inst.token === token) server.delete(id);
      return Promise.resolve(true);
    },
    setUninstallURL: (url) => {
      urls.push(url);
      return Promise.resolve();
    },
    dashboardUrl: DASHBOARD,
    now: () => clock,
    random: (n) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed++ * 7) % 256),
  });
  return {
    installation,
    server,
    calls,
    urls,
    lastUrl: () => urls.at(-1),
    setSession: (next: typeof session) => (session = next),
    setOnline: (value: boolean) => (online = value),
    setMode: (value: typeof mode) => (mode = value),
    advance: (ms: number) => (clock += ms),
  };
}

describe('installation alerts in the extension', () => {
  it('are off by default: no enrolment, no uninstall URL, no network', async () => {
    const t = setup();
    await t.installation.sync();
    await t.installation.checkIn();
    expect(await t.installation.status()).toEqual({ state: 'off' });
    expect(t.calls).toEqual([]);
    expect(t.urls).toEqual([]);
  });

  it('turning on enrols this browser and registers a token-only uninstall URL', async () => {
    const t = setup();
    expect(await t.installation.setEnabled(true)).toEqual({ state: 'on', lastCheckInAt: 1_000 });
    const [inst] = [...t.server.values()];
    expect(inst?.groupId).toBe(GROUP_A);
    expect(t.lastUrl()).toBe(`${DASHBOARD}/removed#t=${inst?.token ?? ''}`);
    // Nothing about the account or group in the URL.
    expect(t.lastUrl()).not.toMatch(/sid-1|grp_|@/);
  });

  it('turning off clears the uninstall URL and revokes the token on the server', async () => {
    const t = setup();
    await t.installation.setEnabled(true);
    expect(await t.installation.setEnabled(false)).toEqual({ state: 'off' });
    expect(t.lastUrl()).toBe('');
    expect(t.server.size).toBe(0);
  });

  it('signing out or switching groups revokes the old enrolment', async () => {
    const t = setup();
    await t.installation.setEnabled(true);
    t.setSession({ sid: 'sid-1', activeGroupId: GROUP_B });
    await t.installation.sync();
    expect([...t.server.values()].map((i) => i.groupId)).toEqual([GROUP_B]);
    t.setSession(null);
    await t.installation.sync();
    expect(t.server.size).toBe(0);
    expect(t.lastUrl()).toBe('');
    expect(await t.installation.status()).toEqual({ state: 'inactive', reason: 'signedOut' });
  });

  it('keeps a revocation made offline and sends it once back online', async () => {
    const t = setup();
    await t.installation.setEnabled(true);
    t.setOnline(false);
    await t.installation.setEnabled(false);
    expect(t.lastUrl()).toBe('');
    expect(t.server.size).toBe(1);
    t.setOnline(true);
    await t.installation.checkIn();
    expect(t.server.size).toBe(0);
  });

  it('revokes an enrolment when a check-in discovers the sign-in ended', async () => {
    const t = setup();
    await t.installation.setEnabled(true);
    t.setSession(null);
    await t.installation.checkIn();
    expect(t.lastUrl()).toBe('');
    expect(t.server.size).toBe(0);
  });

  it('checks in, and enrols again when the server no longer knows this browser', async () => {
    const t = setup();
    await t.installation.setEnabled(true);
    await t.installation.checkIn();
    expect(t.calls.filter((c) => c.endsWith('/checkin'))).toHaveLength(1);
    t.server.clear(); // e.g. the user left the group, or revoked elsewhere
    await t.installation.checkIn();
    expect(t.server.size).toBe(1);
    expect(t.lastUrl()).toMatch(/#t=/);
  });

  it('enrols later when it was offline at the time it was turned on', async () => {
    const t = setup();
    t.setOnline(false);
    expect(await t.installation.setEnabled(true)).toEqual({
      state: 'inactive',
      reason: 'offline',
    });
    t.setOnline(true);
    await t.installation.checkIn();
    expect((await t.installation.status()).state).toBe('on');
  });
});

describe('check-ins on worker start', () => {
  it('are skipped when the last one is recent, and sent when it is older', async () => {
    const t = setup();
    await t.installation.setEnabled(true);
    await t.installation.checkIn({ ifOlderThanMs: 30 * 60_000 });
    expect(t.calls.filter((c) => c.endsWith('/checkin'))).toHaveLength(0);
    await t.installation.checkIn({ ifOlderThanMs: 0 });
    expect(t.calls.filter((c) => c.endsWith('/checkin'))).toHaveLength(1);
  });
});

describe('enrolment that does not complete', () => {
  it('a lost reply is retried with the same identity, never leaving an unknown enrolment', async () => {
    const t = setup();
    t.setMode('commit-then-lose');
    await t.installation.setEnabled(true);
    expect(t.server.size).toBe(1);
    t.setMode('normal');
    await t.installation.checkIn();
    expect(t.server.size).toBe(1);
    expect((await t.installation.status()).state).toBe('on');
    const [inst] = [...t.server.values()];
    expect(t.lastUrl()).toBe(`${DASHBOARD}/removed#t=${inst?.token ?? ''}`);
  });

  it('a pending enrolment is revoked when the setting is turned off first', async () => {
    const t = setup();
    t.setMode('commit-then-lose');
    await t.installation.setEnabled(true);
    t.setMode('normal');
    await t.installation.setEnabled(false);
    expect(t.server.size).toBe(0);
  });

  it('a refused enrolment shows as unavailable and is not retried on every wake-up', async () => {
    const t = setup();
    t.setMode('reject');
    expect(await t.installation.setEnabled(true)).toEqual({
      state: 'inactive',
      reason: 'unavailable',
    });
    const attempts = () => t.calls.filter((c) => c === '/v1/extension/installations').length;
    await t.installation.checkIn({ ifOlderThanMs: 30 * 60_000 });
    expect(attempts()).toBe(1);
    t.advance(31 * 60_000);
    await t.installation.checkIn({ ifOlderThanMs: 30 * 60_000 });
    expect(attempts()).toBe(2);
  });
});
