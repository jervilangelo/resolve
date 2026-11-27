/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { createdInstallationSchema } from '@resolve/contracts';
import { z } from 'zod';
import type { PrivateStore } from './private-store';

/**
 * Installation alerts (docs/MASTER_PLAN.md §7.4), off by default. While the user has them on,
 * this browser is enrolled for its active group: the server returns a random token that only this
 * browser knows, which goes into the uninstall URL (so removal can be reported without any
 * account details in the URL), and the browser checks in periodically so a long silence can be
 * reported. Turning them off, signing out or switching groups revokes the enrolment.
 */

const ENABLED_KEY = 'installAlerts';
const ENROLMENT_KEY = 'installation';
const REVOCATIONS_KEY = 'installationRevocations';
/** An enrolment chosen here and sent, but not yet confirmed (reused on retry, never orphaned). */
const PENDING_KEY = 'installationPending';

const pendingSchema = z.object({
  sid: z.string(),
  groupId: z.string(),
  installationId: z.string(),
  token: z.string(),
  attemptAt: z.number(),
  /** The server refused it (not a member, not allowed): shown, and retried only occasionally. */
  rejected: z.boolean().default(false),
});
type Pending = z.infer<typeof pendingSchema>;

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const enrolmentSchema = z.object({
  sid: z.string(),
  groupId: z.string(),
  installationId: z.string(),
  token: z.string(),
  lastCheckInAt: z.number().nullable(),
});
type Enrolment = z.infer<typeof enrolmentSchema>;

export type InstallAlertsStatus =
  | { state: 'off' }
  | { state: 'on'; lastCheckInAt: number | null }
  | { state: 'inactive'; reason: 'signedOut' | 'noGroup' | 'offline' | 'unavailable' };

/** An authenticated API call made for one sign-in; `offline` when it could not be made. */
export type AuthedRequest = (
  method: 'POST',
  path: string,
  body: unknown,
  sid: string,
) => Promise<{ status: number; json: unknown } | 'offline' | 'signedOut'>;

export interface InstallationDeps {
  store: PrivateStore;
  session(): Promise<{ sid: string; activeGroupId: string | null } | null>;
  authed: AuthedRequest;
  /** Unauthenticated POST to the API (token routes); false when it could not be delivered. */
  post(path: string, body: unknown): Promise<boolean>;
  setUninstallURL(url: string): Promise<void>;
  dashboardUrl: string;
  now(): number;
  /** Cryptographically random bytes (installation ID and token are chosen here). */
  random(bytes: number): Uint8Array;
}

export function createInstallation(deps: InstallationDeps) {
  const { store } = deps;
  let queue: Promise<unknown> = Promise.resolve();
  /** Serialises every change, so a sync and a check-in never enrol twice. */
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.catch(() => undefined).then(task);
    queue = run;
    return run;
  };

  const enabled = async () => (await store.get(ENABLED_KEY)) === true;
  const enrolment = async (): Promise<Enrolment | null> => {
    const parsed = enrolmentSchema.safeParse(await store.get(ENROLMENT_KEY));
    return parsed.success ? parsed.data : null;
  };
  const pending = async (): Promise<Pending | null> => {
    const parsed = pendingSchema.safeParse(await store.get(PENDING_KEY));
    return parsed.success ? parsed.data : null;
  };
  const newIdentity = () => ({
    installationId: `ins_${Array.from(deps.random(26), (b) => BASE32[b % 32] ?? 'a').join('')}`,
    token: base64url(deps.random(32)),
  });
  const queueRevocation = (token: string) =>
    store.update(REVOCATIONS_KEY, (raw) => [
      ...new Set([...z.array(z.string()).catch([]).parse(raw), token]),
    ]);
  const uninstallUrl = (token: string) =>
    new URL(`/removed#t=${token}`, deps.dashboardUrl).toString();

  /** Sends pending revocations; those that could not be delivered stay for the next try. */
  async function flushRevocations() {
    const pending = z
      .array(z.string())
      .catch([])
      .parse(await store.get(REVOCATIONS_KEY));
    const left: string[] = [];
    for (const token of pending) {
      if (!(await deps.post('/v1/installations/revoke', { token }))) left.push(token);
    }
    if (left.length) await store.set(REVOCATIONS_KEY, left);
    else await store.remove(REVOCATIONS_KEY);
  }

  /** Forgets the enrolment here at once (no removal report any more) and revokes it on the server. */
  async function drop(current: Enrolment) {
    await deps.setUninstallURL('');
    await queueRevocation(current.token);
    await store.remove(ENROLMENT_KEY);
  }

  async function reconcile(): Promise<void> {
    const session = await deps.session();
    const want =
      (await enabled()) && session?.activeGroupId
        ? { sid: session.sid, groupId: session.activeGroupId }
        : null;
    const current = await enrolment();
    if (current && (current.sid !== want?.sid || current.groupId !== want.groupId)) {
      await drop(current);
    } else if (current) {
      // Already enrolled: make sure the browser still has the uninstall URL (e.g. after a restart).
      await deps.setUninstallURL(uninstallUrl(current.token));
    }
    // A pending enrolment for another sign-in or group may exist on the server: revoke it.
    const tried = await pending();
    const matches = tried?.sid === want?.sid && tried?.groupId === want?.groupId;
    if (tried && !matches) {
      await queueRevocation(tried.token);
      await store.remove(PENDING_KEY);
    }
    await flushRevocations();
    if (!want || (current?.sid === want.sid && current.groupId === want.groupId)) return;

    // Chosen and saved before sending, so a lost reply is retried with the same identity.
    const attempt: Pending =
      tried && matches
        ? { ...tried, attemptAt: deps.now(), rejected: false }
        : { ...want, ...newIdentity(), attemptAt: deps.now(), rejected: false };
    await store.set(PENDING_KEY, attempt);
    const res = await deps.authed(
      'POST',
      '/v1/extension/installations',
      { groupId: want.groupId, installationId: attempt.installationId, token: attempt.token },
      want.sid,
    );
    if (res === 'offline') return;
    if (res === 'signedOut' || res.status !== 201) {
      await store.set(PENDING_KEY, { ...attempt, rejected: res !== 'signedOut' });
      return;
    }
    const created = createdInstallationSchema.safeParse(res.json);
    if (!created.success || created.data.token !== attempt.token) return;
    await store.set(ENROLMENT_KEY, {
      ...want,
      installationId: attempt.installationId,
      token: attempt.token,
      lastCheckInAt: deps.now(),
    } satisfies Enrolment);
    await store.remove(PENDING_KEY);
    await deps.setUninstallURL(uninstallUrl(attempt.token));
  }

  return {
    /** Brings the enrolment in line with the setting, the sign-in and the active group. */
    sync: () => serial(reconcile),

    async setEnabled(on: boolean): Promise<InstallAlertsStatus> {
      await store.set(ENABLED_KEY, on);
      await serial(reconcile);
      return this.status();
    },

    /**
     * The periodic check-in (alarm, and whenever the worker starts: browser start, re-enabled,
     * updated). With `ifOlderThanMs`, it is skipped when the last check-in is more recent, so
     * frequent worker wake-ups cost one local read. The server ends a stale enrolment with 404.
     */
    checkIn: ({ ifOlderThanMs }: { ifOlderThanMs?: number } = {}) =>
      serial(async () => {
        await flushRevocations();
        const current = await enrolment();
        if (!current) {
          // Not enrolled yet: retry, but not on every worker wake-up after a recent attempt.
          const tried = await pending();
          if (
            ifOlderThanMs !== undefined &&
            tried &&
            deps.now() - tried.attemptAt < ifOlderThanMs
          ) {
            return;
          }
          return reconcile();
        }
        if (
          ifOlderThanMs !== undefined &&
          current.lastCheckInAt !== null &&
          deps.now() - current.lastCheckInAt < ifOlderThanMs
        ) {
          return;
        }
        const res = await deps.authed(
          'POST',
          `/v1/extension/installations/${current.installationId}/checkin`,
          {},
          current.sid,
        );
        if (res === 'offline') return;
        if (res === 'signedOut') {
          await drop(current);
          return reconcile();
        }
        if (res.status === 404) {
          // Revoked elsewhere or the group left: start over from the setting.
          await deps.setUninstallURL('');
          await store.remove(ENROLMENT_KEY);
          return reconcile();
        }
        if (res.status === 204)
          await store.set(ENROLMENT_KEY, { ...current, lastCheckInAt: deps.now() });
      }),

    async status(): Promise<InstallAlertsStatus> {
      if (!(await enabled())) return { state: 'off' };
      const session = await deps.session();
      if (!session) return { state: 'inactive', reason: 'signedOut' };
      if (!session.activeGroupId) return { state: 'inactive', reason: 'noGroup' };
      const current = await enrolment();
      if (current?.sid !== session.sid || current.groupId !== session.activeGroupId) {
        const tried = await pending();
        return { state: 'inactive', reason: tried?.rejected ? 'unavailable' : 'offline' };
      }
      return { state: 'on', lastCheckInAt: current.lastCheckInAt };
    },
  };
}

export type Installation = ReturnType<typeof createInstallation>;
