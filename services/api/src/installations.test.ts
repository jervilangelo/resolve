/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  INACTIVITY_GRACE_HOURS,
  accountabilityViewSchema,
  createdInstallationSchema,
  createdInvitationSchema,
  groupSummarySchema,
} from '@resolve/contracts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from './env';
import { createHandler } from './http';
import { scanInactiveInstallations } from './installations';
import { createLogger } from './logger';
import { createRouter, createRoutes } from './routes';
import { createMemoryStore } from './store/memory';

/** Installation alerts (docs/MASTER_PLAN.md §7.4): removal and inactivity, opt-in on both sides. */

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';
const HOUR = 60 * 60;

const env: ApiEnv = {
  STAGE: 'test',
  LOG_LEVEL: 'error',
  TABLE_NAME: 'resolve-test',
  ALLOWED_CLIENT_IDS: ['web-client', 'ext-client'],
  RULES_CLIENT_IDS: ['ext-client'],
};

beforeEach(() => {
  vi.stubEnv('STAGE', env.STAGE);
  vi.stubEnv('TABLE_NAME', env.TABLE_NAME);
  vi.stubEnv('ALLOWED_CLIENT_IDS', 'web-client,ext-client');
});

async function setup() {
  let clock = new Date('2026-11-24T00:00:00Z');
  const store = createMemoryStore();
  const handler = createHandler(
    'test',
    createRouter(createRoutes({ env, store, now: () => clock })),
    createLogger('error', () => undefined),
  );
  async function call(
    routeKey: string,
    user: string | null,
    params: Record<string, string>,
    body?: unknown,
    client = 'web-client',
  ) {
    const event = {
      routeKey,
      headers: {},
      body: body === undefined ? undefined : JSON.stringify(body),
      isBase64Encoded: false,
      pathParameters: params,
      requestContext: {
        requestId: 'req-1',
        ...(user && {
          authorizer: { jwt: { claims: { sub: user, token_use: 'access', client_id: client } } },
        }),
      },
    } as unknown as APIGatewayProxyEventV2;
    const res = await handler(event);
    return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as unknown) : null };
  }
  const advance = (seconds: number) => {
    clock = new Date(clock.getTime() + seconds * 1000);
  };
  const created = await call('POST /v1/groups', ALICE, {}, { name: 'Brothers' });
  const groupId = groupSummarySchema.parse(created.body).groupId;
  const g = { groupId };
  for (const user of [BOB, CAROL]) {
    advance(60);
    const inv = await call('POST /v1/groups/{groupId}/invitations', ALICE, g, {});
    const { token } = createdInvitationSchema.parse(inv.body);
    await call('POST /v1/invitations/accept', user, {}, { token });
  }
  await call('PATCH /v1/me', BOB, {}, { displayName: 'Bob' });

  const types = (user: string, body: unknown) => {
    advance(60);
    return call('PUT /v1/groups/{groupId}/accountability/alert-types', user, g, body);
  };
  /** Bob shares everything with Carol, and Carol agreed to his alerts and to both types. */
  const consentAll = async () => {
    advance(60);
    await call('PUT /v1/groups/{groupId}/accountability/sharing', BOB, g, {
      mode: 'SELECTED',
      recipientIds: [CAROL],
    });
    advance(60);
    await call('PUT /v1/groups/{groupId}/accountability/senders/{userId}', CAROL, {
      groupId,
      userId: BOB,
    });
    await types(BOB, { share: { removal: true, inactivity: true } });
    await types(CAROL, { receive: { removal: true, inactivity: true } });
  };
  const enrol = async (user = BOB) => {
    const res = await call('POST /v1/extension/installations', user, {}, { groupId }, 'ext-client');
    return { status: res.status, ...createdInstallationSchema.parse(res.body) };
  };
  const checkIn = (installationId: string, user = BOB) =>
    call(
      'POST /v1/extension/installations/{installationId}/checkin',
      user,
      { installationId },
      {},
      'ext-client',
    );
  const removed = (token: string) => call('POST /v1/installations/removed', null, {}, { token });
  const revoke = (token: string) => call('POST /v1/installations/revoke', null, {}, { token });
  const scan = () => scanInactiveInstallations(store, clock);
  const kinds = () => store.outboxItems().map((i) => i.kind);
  return {
    call,
    store,
    groupId,
    g,
    advance,
    types,
    consentAll,
    enrol,
    checkIn,
    removed,
    revoke,
    scan,
    kinds,
    now: () => clock,
  };
}

describe('alert-type choices', () => {
  it('are all off by default and change one switch at a time, for oneself only', async () => {
    const t = await setup();
    const view = await t.call('GET /v1/groups/{groupId}/accountability', BOB, t.g);
    expect(accountabilityViewSchema.parse(view.body).alertTypes).toEqual({
      share: { removal: false, inactivity: false },
      receive: { removal: false, inactivity: false },
    });
    const res = await t.types(BOB, { share: { removal: true } });
    expect(accountabilityViewSchema.parse(res.body).alertTypes.share).toEqual({
      removal: true,
      inactivity: false,
    });
    const carol = await t.call('GET /v1/groups/{groupId}/accountability', CAROL, t.g);
    expect(accountabilityViewSchema.parse(carol.body).alertTypes.share.removal).toBe(false);
    expect((await t.types(BOB, { share: { removal: 'yes' } })).status).toBe(422);
  });
});

describe('enrolment', () => {
  it('is for the extension only, for a group the user belongs to, with a 256-bit token', async () => {
    const t = await setup();
    const web = await t.call('POST /v1/extension/installations', BOB, {}, { groupId: t.groupId });
    expect(web.status).toBe(403);
    const enrolled = await t.enrol();
    expect(enrolled.status).toBe(201);
    expect(enrolled.token).toHaveLength(43);
    expect(enrolled.installationId).toMatch(/^ins_/);
    const outsider = '44444444-4444-4444-8444-444444444444';
    const res = await t.call(
      'POST /v1/extension/installations',
      outsider,
      {},
      { groupId: t.groupId },
      'ext-client',
    );
    expect(res.status).toBe(404);
  });
});

describe('removal', () => {
  it('queues one alert with the name and time only; repeated callbacks change nothing', async () => {
    const t = await setup();
    await t.consentAll();
    const { token } = await t.enrol();
    t.advance(HOUR);
    expect(await t.removed(token)).toEqual({ status: 202, body: { status: 'received' } });
    expect(await t.removed(token)).toEqual({ status: 202, body: { status: 'received' } });
    const items = t.store.outboxItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'EXTENSION_REMOVED',
      senderId: BOB,
      senderName: 'Bob',
      recipientIds: [CAROL],
      occurredAt: t.now().toISOString(),
    });
    expect(JSON.stringify(items[0])).not.toContain(token);
  });

  it('answers unknown tokens the same way and sends nothing', async () => {
    const t = await setup();
    await t.consentAll();
    const res = await t.removed('A'.repeat(43));
    expect(res.status).toBe(202);
    expect(t.kinds()).toEqual([]);
    expect((await t.removed('short')).status).toBe(422);
  });

  it('reaches only recipients who agreed to removal alerts from a sender who shares them', async () => {
    const t = await setup();
    await t.consentAll();
    await t.types(CAROL, { receive: { removal: false } });
    await t.removed((await t.enrol()).token);
    expect(t.kinds()).toEqual([]);

    const u = await setup();
    await u.consentAll();
    await u.types(BOB, { share: { removal: false } });
    await u.removed((await u.enrol()).token);
    expect(u.kinds()).toEqual([]);
  });

  it('suppresses a pending inactivity alert for the same browser', async () => {
    const t = await setup();
    await t.consentAll();
    const { token } = await t.enrol();
    t.advance((INACTIVITY_GRACE_HOURS + 1) * HOUR);
    await t.removed(token);
    expect((await t.scan()).due).toBe(0);
    expect(t.kinds()).toEqual(['EXTENSION_REMOVED']);
  });

  it('is one browser only: other enrolled browsers keep checking in', async () => {
    const t = await setup();
    await t.consentAll();
    const first = await t.enrol();
    const second = await t.enrol();
    await t.removed(first.token);
    expect((await t.checkIn(first.installationId)).status).toBe(404);
    expect((await t.checkIn(second.installationId)).status).toBe(204);
  });
});

describe('revocation', () => {
  it('stops both alerts at once, without needing a sign-in', async () => {
    const t = await setup();
    await t.consentAll();
    const { token, installationId } = await t.enrol();
    expect((await t.revoke(token)).status).toBe(204);
    await t.removed(token);
    expect((await t.checkIn(installationId)).status).toBe(404);
    t.advance((INACTIVITY_GRACE_HOURS + 1) * HOUR);
    expect((await t.scan()).due).toBe(0);
    expect(t.kinds()).toEqual([]);
  });

  it('ends with the membership and with account deletion', async () => {
    const t = await setup();
    await t.consentAll();
    const { installationId } = await t.enrol();
    await t.call('POST /v1/groups/{groupId}/leave', BOB, t.g);
    expect((await t.checkIn(installationId)).status).toBe(404);

    const u = await setup();
    const { token } = await u.enrol(CAROL);
    await u.call('DELETE /v1/me', CAROL, {});
    await u.removed(token);
    expect(u.kinds().filter((k) => k.startsWith('EXTENSION'))).toEqual([]);
  });
});

describe('inactivity', () => {
  it('alerts once per silent period, after the grace period, and resets on check-in', async () => {
    const t = await setup();
    await t.consentAll();
    const { installationId } = await t.enrol();
    const lastCheckIn = t.now().toISOString();
    t.advance((INACTIVITY_GRACE_HOURS - 1) * HOUR);
    expect((await t.scan()).due).toBe(0);
    t.advance(2 * HOUR);
    expect(await t.scan()).toMatchObject({ due: 1, alerted: 1 });
    expect(t.store.outboxItems()[0]).toMatchObject({
      kind: 'EXTENSION_INACTIVE',
      recipientIds: [CAROL],
      occurredAt: lastCheckIn,
    });
    t.advance(HOUR);
    expect((await t.scan()).due).toBe(0);

    // Back online: the clock restarts, and a new silent period can alert again.
    expect((await t.checkIn(installationId)).status).toBe(204);
    t.advance(HOUR);
    expect((await t.scan()).due).toBe(0);
    t.advance(INACTIVITY_GRACE_HOURS * HOUR);
    expect((await t.scan()).alerted).toBe(1);
    expect(t.kinds()).toEqual(['EXTENSION_INACTIVE', 'EXTENSION_INACTIVE']);
  });

  it('marks the period without an email when nobody may receive it', async () => {
    const t = await setup();
    await t.enrol();
    t.advance((INACTIVITY_GRACE_HOURS + 1) * HOUR);
    expect(await t.scan()).toMatchObject({ due: 1, alerted: 0, silent: 1 });
    expect(t.kinds()).toEqual([]);
    expect((await t.scan()).due).toBe(0);
  });

  it('regular check-ins never alert', async () => {
    const t = await setup();
    await t.consentAll();
    const { installationId } = await t.enrol();
    for (let i = 0; i < 10; i++) {
      t.advance(24 * HOUR);
      await t.checkIn(installationId);
      await t.scan();
    }
    expect(t.kinds()).toEqual([]);
  });
});
