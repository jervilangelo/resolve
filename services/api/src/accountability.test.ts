/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  type AccountabilityView,
  accountabilityViewSchema,
  createdInvitationSchema,
  groupSummarySchema,
} from '@resolve/contracts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type AccountabilityState, eligibleRecipients } from './accountability';
import type { ApiEnv } from './env';
import { createHandler } from './http';
import { createLogger } from './logger';
import { createRouter, createRoutes } from './routes';
import { createMemoryStore } from './store/memory';
import type { StoredConsent, StoredMember, StoredSharing } from './store/store';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';
const DAVE = '44444444-4444-4444-8444-444444444444';

// ---- The resolver on its own (§6.2) -------------------------------------------------------------

const member = (userId: string, joinedAt = '2026-01-01T00:00:00.000Z'): StoredMember => ({
  userId,
  displayName: null,
  role: 'MEMBER',
  joinedAt,
});
const T = '2026-06-01T00:00:00.000Z';

function state(
  sharing: Record<string, StoredSharing>,
  consents: Record<string, StoredConsent>,
): AccountabilityState {
  return { sharing: new Map(Object.entries(sharing)), consents: new Map(Object.entries(consents)) };
}

describe('eligibleRecipients', () => {
  const group = [member(ALICE), member(BOB), member(CAROL)];

  it('PRIVATE (and no stored choice) reaches nobody, whatever others consented to', () => {
    const everyoneAccepts = { [BOB]: { acceptAll: true, senders: {} } };
    expect(eligibleRecipients(ALICE, group, state({}, everyoneAccepts))).toEqual([]);
    const privateSharing = { [ALICE]: { mode: 'PRIVATE' as const, recipients: {}, updatedAt: T } };
    expect(eligibleRecipients(ALICE, group, state(privateSharing, everyoneAccepts))).toEqual([]);
  });

  it('SELECTED reaches only chosen members who agreed', () => {
    const s = state(
      { [ALICE]: { mode: 'SELECTED', recipients: { [BOB]: T, [CAROL]: T }, updatedAt: T } },
      { [BOB]: { acceptAll: false, senders: { [ALICE]: T } } },
    );
    expect(eligibleRecipients(ALICE, group, s)).toEqual([BOB]);
  });

  it('EVERYONE reaches every other member who agreed, never the sender', () => {
    const s = state(
      { [ALICE]: { mode: 'EVERYONE', recipients: {}, updatedAt: T } },
      {
        [ALICE]: { acceptAll: true, senders: {} },
        [BOB]: { acceptAll: true, senders: {} },
        [CAROL]: { acceptAll: false, senders: {} },
      },
    );
    expect(eligibleRecipients(ALICE, group, s)).toEqual([BOB]);
  });

  it('ignores choices made before the other person (re)joined: no retroactive exposure', () => {
    const rejoined = [member(ALICE), member(BOB, '2026-07-01T00:00:00.000Z')];
    // Alice chose Bob, and Bob accepted Alice, during Bob's previous membership.
    const s = state(
      { [ALICE]: { mode: 'SELECTED', recipients: { [BOB]: T }, updatedAt: T } },
      { [BOB]: { acceptAll: false, senders: { [ALICE]: T } } },
    );
    expect(eligibleRecipients(ALICE, rejoined, s)).toEqual([]);
    // Alice re-joined after Bob accepted her: his old consent no longer counts either.
    const aliceRejoined = [member(ALICE, '2026-07-01T00:00:00.000Z'), member(BOB)];
    const s2 = state(
      { [ALICE]: { mode: 'EVERYONE', recipients: {}, updatedAt: '2026-07-02T00:00:00.000Z' } },
      { [BOB]: { acceptAll: false, senders: { [ALICE]: T } } },
    );
    expect(eligibleRecipients(ALICE, aliceRejoined, s2)).toEqual([]);
  });

  it('ignores recipients and senders who are no longer members', () => {
    const s = state(
      { [ALICE]: { mode: 'SELECTED', recipients: { [DAVE]: T }, updatedAt: T } },
      { [DAVE]: { acceptAll: true, senders: {} } },
    );
    expect(eligibleRecipients(ALICE, group, s)).toEqual([]);
    expect(eligibleRecipients(DAVE, group, s)).toEqual([]);
  });
});

// ---- Through the API ----------------------------------------------------------------------------

const env: ApiEnv = {
  STAGE: 'test',
  LOG_LEVEL: 'error',
  TABLE_NAME: 'resolve-test',
  ALLOWED_CLIENT_IDS: ['web-client'],
  RULES_CLIENT_IDS: [],
};

beforeEach(() => {
  vi.stubEnv('STAGE', env.STAGE);
  vi.stubEnv('TABLE_NAME', env.TABLE_NAME);
  vi.stubEnv('ALLOWED_CLIENT_IDS', 'web-client');
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
    user: string,
    params: Record<string, string>,
    body?: unknown,
  ) {
    const event = {
      routeKey,
      headers: {},
      body: body === undefined ? undefined : JSON.stringify(body),
      isBase64Encoded: false,
      pathParameters: params,
      requestContext: {
        requestId: 'req-1',
        authorizer: {
          jwt: { claims: { sub: user, token_use: 'access', client_id: 'web-client' } },
        },
      },
    } as unknown as APIGatewayProxyEventV2;
    const res = await handler(event);
    return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as unknown) : null };
  }
  const tick = () => {
    clock = new Date(clock.getTime() + 60_000);
  };

  const created = await call('POST /v1/groups', ALICE, {}, { name: 'Brothers' });
  const groupId = groupSummarySchema.parse(created.body).groupId;
  async function join(user: string) {
    tick();
    const inv = await call('POST /v1/groups/{groupId}/invitations', ALICE, { groupId }, {});
    const { token } = createdInvitationSchema.parse(inv.body);
    expect((await call('POST /v1/invitations/accept', user, {}, { token })).status).toBe(201);
  }
  await join(BOB);
  await join(CAROL);

  const g = { groupId };
  const view = async (user: string): Promise<AccountabilityView> => {
    const res = await call('GET /v1/groups/{groupId}/accountability', user, g);
    expect(res.status).toBe(200);
    return accountabilityViewSchema.parse(res.body);
  };
  const share = (user: string, mode: string, recipientIds: string[] = []) => {
    tick();
    return call('PUT /v1/groups/{groupId}/accountability/sharing', user, g, { mode, recipientIds });
  };
  const acceptAll = (user: string, value: boolean) => {
    tick();
    return call('PUT /v1/groups/{groupId}/accountability/receiving', user, g, {
      acceptAll: value,
    });
  };
  const accept = (user: string, sender: string) => {
    tick();
    return call('PUT /v1/groups/{groupId}/accountability/senders/{userId}', user, {
      groupId,
      userId: sender,
    });
  };
  const withdraw = (user: string, sender: string) => {
    tick();
    return call('DELETE /v1/groups/{groupId}/accountability/senders/{userId}', user, {
      groupId,
      userId: sender,
    });
  };
  const receivers = async (sender: string) =>
    (await view(sender)).recipients.filter((r) => r.status === 'receiving').map((r) => r.userId);
  const resolved = async (sender: string) =>
    eligibleRecipients(
      sender,
      (await store.listMembers(groupId, 50)).items,
      await store.getAccountability(groupId),
    );
  return { call, groupId, join, view, share, acceptAll, accept, withdraw, receivers, resolved };
}

describe('accountability sharing and consent', () => {
  it('defaults to PRIVATE with no consent', async () => {
    const t = await setup();
    expect(await t.view(BOB)).toEqual({
      sharing: { mode: 'PRIVATE', recipientIds: [], updatedAt: null },
      receiving: { acceptAll: false },
      recipients: [],
      senders: [],
    });
    expect(await t.resolved(BOB)).toEqual([]);
  });

  it('SELECTED: chosen members see the request and receive only after agreeing', async () => {
    const t = await setup();
    expect((await t.share(BOB, 'SELECTED', [ALICE])).status).toBe(200);
    // Alice is asked; Carol (not chosen) sees nothing about Bob.
    expect((await t.view(ALICE)).senders).toEqual([
      { userId: BOB, displayName: null, status: 'needs_consent' },
    ]);
    expect((await t.view(CAROL)).senders).toEqual([]);
    expect(await t.resolved(BOB)).toEqual([]);
    expect((await t.view(BOB)).recipients).toEqual([
      { userId: ALICE, displayName: null, status: 'awaiting' },
    ]);

    await t.accept(ALICE, BOB);
    expect(await t.resolved(BOB)).toEqual([ALICE]);
    expect(await t.receivers(BOB)).toEqual([ALICE]);
  });

  it('EVERYONE reaches all members who accept everyone or this sender', async () => {
    const t = await setup();
    await t.share(BOB, 'EVERYONE');
    await t.acceptAll(ALICE, true);
    expect(await t.resolved(BOB)).toEqual([ALICE]);
    await t.accept(CAROL, BOB);
    expect((await t.resolved(BOB)).sort()).toEqual([ALICE, CAROL].sort());
  });

  it('one-way sharing needs no reciprocity; mutual is two independent choices', async () => {
    const t = await setup();
    await t.share(BOB, 'SELECTED', [CAROL]);
    await t.accept(CAROL, BOB);
    expect(await t.resolved(BOB)).toEqual([CAROL]);
    expect(await t.resolved(CAROL)).toEqual([]); // Carol keeps her own alerts private

    await t.share(CAROL, 'SELECTED', [BOB]);
    expect(await t.resolved(CAROL)).toEqual([]); // until Bob agrees
    await t.accept(BOB, CAROL);
    expect(await t.resolved(CAROL)).toEqual([BOB]);
    expect(await t.resolved(BOB)).toEqual([CAROL]);
  });

  it('withdrawing consent or going private stops alerts at once', async () => {
    const t = await setup();
    await t.share(BOB, 'EVERYONE');
    await t.accept(ALICE, BOB);
    await t.acceptAll(CAROL, true);
    expect((await t.resolved(BOB)).sort()).toEqual([ALICE, CAROL].sort());

    await t.withdraw(ALICE, BOB);
    expect(await t.resolved(BOB)).toEqual([CAROL]);
    await t.acceptAll(CAROL, false);
    expect(await t.resolved(BOB)).toEqual([]);

    await t.acceptAll(CAROL, true);
    await t.share(BOB, 'PRIVATE');
    expect(await t.resolved(BOB)).toEqual([]);
  });

  it('admins cannot read or change anyone else’s choices', async () => {
    const t = await setup();
    await t.share(BOB, 'SELECTED', [CAROL]);
    // Alice (admin) sees only her own view: nothing about Bob and Carol.
    const adminView = await t.view(ALICE);
    expect(adminView.senders).toEqual([]);
    expect(adminView.recipients).toEqual([]);
    // The routes take no target user for sharing or receiving: the body cannot name another member.
    const res = await t.call(
      'PUT /v1/groups/{groupId}/accountability/sharing',
      ALICE,
      { groupId: t.groupId },
      { mode: 'PRIVATE', recipientIds: [], userId: BOB },
    );
    expect(res.status).toBe(422);
    expect((await t.view(BOB)).sharing.mode).toBe('SELECTED');
  });

  it('rejects recipients who are not fellow members, and non-members entirely', async () => {
    const t = await setup();
    expect((await t.share(BOB, 'SELECTED', [BOB])).status).toBe(422);
    expect((await t.share(BOB, 'SELECTED', [DAVE])).status).toBe(422);
    expect((await t.share(BOB, 'SELECTED', [])).status).toBe(422);
    expect((await t.share(BOB, 'EVERYONE', [ALICE])).status).toBe(422);
    expect((await t.accept(BOB, DAVE)).status).toBe(404);
    expect((await t.accept(BOB, BOB)).status).toBe(404);
    const outsider = await t.call('GET /v1/groups/{groupId}/accountability', DAVE, {
      groupId: t.groupId,
    });
    expect(outsider.status).toBe(404);
  });

  it('limits how often a member can change their choices; unchanged saves are free', async () => {
    const t = await setup();
    // Within one hour (the clock does not move here).
    const put = (acceptAll: boolean) =>
      t.call(
        'PUT /v1/groups/{groupId}/accountability/receiving',
        BOB,
        { groupId: t.groupId },
        {
          acceptAll,
        },
      );
    for (let i = 0; i < 100; i += 1) expect((await put(false)).status).toBe(200);
    const statuses = [];
    for (let i = 0; i < 61; i += 1) statuses.push((await put(i % 2 === 0)).status);
    expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
  });

  it('leaving clears your choices, and earlier consent to you does not carry over', async () => {
    const t = await setup();
    await t.share(BOB, 'EVERYONE');
    await t.acceptAll(BOB, true);
    await t.accept(CAROL, BOB);
    await t.share(ALICE, 'SELECTED', [BOB]);
    expect(
      (await t.call('POST /v1/groups/{groupId}/leave', BOB, { groupId: t.groupId })).status,
    ).toBe(204);
    expect(await t.resolved(ALICE)).toEqual([]); // Bob is gone

    await t.join(BOB);
    // Bob starts private; Carol's old consent and Alice's old choice need renewing.
    expect((await t.view(BOB)).sharing.mode).toBe('PRIVATE');
    await t.share(BOB, 'EVERYONE');
    expect(await t.resolved(BOB)).toEqual([]);
    expect((await t.view(ALICE)).sharing.recipientIds).toEqual([]);
    expect((await t.view(CAROL)).senders).toEqual([
      { userId: BOB, displayName: null, status: 'needs_consent' },
    ]);
  });
});
