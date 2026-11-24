/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { createdInvitationSchema, groupSummarySchema } from '@resolve/contracts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from './env';
import { createHandler } from './http';
import { createLogger } from './logger';
import { createRouter, createRoutes } from './routes';
import { createMemoryStore } from './store/memory';

/** The two and only two alert triggers (docs/MASTER_PLAN.md §7), as far as the API's part goes. */

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';

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

let counter = 0;
/** Distinct valid event IDs: the counter written in the base32 alphabet. */
const eventId = () =>
  `evt_${(++counter)
    .toString(32)
    .replace(/[0-9]/g, (d) => 'abcdefghij'[Number(d)] ?? 'a')
    .padStart(26, 'z')}`;

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
        authorizer: { jwt: { claims: { sub: user, token_use: 'access', client_id: client } } },
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
  const share = (user: string, mode: string, recipientIds: string[] = []) => {
    advance(60);
    return call('PUT /v1/groups/{groupId}/accountability/sharing', user, g, { mode, recipientIds });
  };
  const accept = (user: string, sender: string) => {
    advance(60);
    return call('PUT /v1/groups/{groupId}/accountability/senders/{userId}', user, {
      groupId,
      userId: sender,
    });
  };
  const report = (user: string, overrides: Record<string, unknown> = {}, client = 'ext-client') =>
    call(
      'POST /v1/events',
      user,
      {},
      {
        eventId: eventId(),
        groupId,
        eventType: 'NON_NEGOTIABLE_NAVIGATION',
        occurredAt: clock.toISOString(),
        clientRuleVersion: 3,
        ...overrides,
      },
      client,
    );
  return { call, store, groupId, g, advance, share, accept, report };
}

describe('Trigger A: non-negotiable navigation', () => {
  it('queues one generic alert for consenting recipients, with no browsing detail', async () => {
    const t = await setup();
    await t.share(BOB, 'SELECTED', [CAROL]);
    await t.accept(CAROL, BOB);
    const res = await t.report(BOB);
    expect(res).toEqual({ status: 202, body: { status: 'received' } });
    const [item] = t.store.outboxItems();
    expect(item).toMatchObject({
      kind: 'NON_NEGOTIABLE_NAVIGATION',
      groupName: 'Brothers',
      senderId: BOB,
      senderName: 'Bob',
      recipientIds: [CAROL],
    });
    // Nothing about what was visited exists anywhere in the item.
    expect(JSON.stringify(item)).not.toMatch(/url|domain|host|title/i);
  });

  it('records nothing when the sender is private or nobody consented', async () => {
    const t = await setup();
    expect((await t.report(BOB)).status).toBe(202);
    await t.share(BOB, 'EVERYONE');
    expect((await t.report(BOB)).status).toBe(202);
    expect(t.store.outboxItems()).toEqual([]);
  });

  it('is idempotent per event ID and rate-limited by a per-member cooldown', async () => {
    const t = await setup();
    await t.share(BOB, 'EVERYONE');
    await t.accept(ALICE, BOB);
    const id = eventId();
    await t.report(BOB, { eventId: id });
    await t.report(BOB, { eventId: id }); // retry of the same event
    await t.report(BOB); // a new event inside the cooldown
    expect(t.store.outboxItems()).toHaveLength(1);
    t.advance(10 * 60 + 1);
    await t.report(BOB);
    expect(t.store.outboxItems()).toHaveLength(2);
  });

  it('accepts only the extension, members, minimal bodies and plausible times', async () => {
    const t = await setup();
    await t.share(BOB, 'EVERYONE');
    await t.accept(ALICE, BOB);
    expect((await t.report(BOB, {}, 'web-client')).status).toBe(403);
    expect((await t.report('44444444-4444-4444-8444-444444444444')).status).toBe(404);
    expect((await t.report(BOB, { url: 'https://example.com/' })).status).toBe(422);
    expect((await t.report(BOB, { userId: ALICE })).status).toBe(422);
    expect((await t.report(BOB, { eventType: 'OTHER' })).status).toBe(422);
    const stale = new Date(Date.parse('2026-11-24T00:00:00Z') - 2 * 60 * 60 * 1000);
    expect((await t.report(BOB, { occurredAt: stale.toISOString() })).status).toBe(202);
    expect(t.store.outboxItems()).toEqual([]);
  });
});

describe('Trigger B: group departure', () => {
  it('snapshots pre-departure recipients when a member leaves', async () => {
    const t = await setup();
    await t.share(BOB, 'SELECTED', [CAROL]);
    await t.accept(CAROL, BOB);
    expect((await t.call('POST /v1/groups/{groupId}/leave', BOB, t.g)).status).toBe(204);
    expect(t.store.outboxItems()).toEqual([
      expect.objectContaining({
        kind: 'GROUP_DEPARTURE',
        senderId: BOB,
        recipientIds: [CAROL],
        departureSharing: expect.objectContaining({ mode: 'SELECTED' }) as unknown,
      }),
    ]);
  });

  it('also alerts on admin removal, never notifying anyone for a private member', async () => {
    const t = await setup();
    await t.accept(CAROL, BOB); // consent alone authorizes nothing
    await t.call('DELETE /v1/groups/{groupId}/members/{userId}', ALICE, {
      groupId: t.groupId,
      userId: BOB,
    });
    expect(t.store.outboxItems()).toEqual([]);

    await t.share(CAROL, 'EVERYONE');
    await t.accept(ALICE, CAROL);
    expect(
      (
        await t.call('DELETE /v1/groups/{groupId}/members/{userId}', ALICE, {
          groupId: t.groupId,
          userId: CAROL,
        })
      ).status,
    ).toBe(204);
    expect(t.store.outboxItems()).toEqual([
      expect.objectContaining({ kind: 'GROUP_DEPARTURE', senderId: CAROL, recipientIds: [ALICE] }),
    ]);
  });
});
