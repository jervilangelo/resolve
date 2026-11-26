/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
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

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

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

function setup({ canDelete = true } = {}) {
  let clock = new Date('2026-11-25T00:00:00Z');
  const store = createMemoryStore();
  const deleted: string[] = [];
  const handler = createHandler(
    'test',
    createRouter(
      createRoutes({
        env,
        store,
        now: () => clock,
        ...(canDelete && {
          deleteIdentity: (userId: string) => {
            deleted.push(userId);
            return Promise.resolve();
          },
        }),
      }),
    ),
    createLogger('error', () => undefined),
  );
  async function call(
    routeKey: string,
    user: string,
    params: Record<string, string>,
    body?: unknown,
  ) {
    clock = new Date(clock.getTime() + 60_000);
    const res = await handler({
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
    } as unknown as APIGatewayProxyEventV2);
    return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as unknown) : null };
  }
  async function group(owner: string, name: string, ...members: string[]) {
    const groupId = groupSummarySchema.parse(
      (await call('POST /v1/groups', owner, {}, { name })).body,
    ).groupId;
    for (const member of members) {
      const inv = createdInvitationSchema.parse(
        (await call('POST /v1/groups/{groupId}/invitations', owner, { groupId }, {})).body,
      );
      await call('POST /v1/invitations/accept', member, {}, { token: inv.token });
    }
    return groupId;
  }
  return { store, call, group, deleted };
}

describe('account deletion', () => {
  it('leaves shared groups, dissolves solo groups, deletes data and the sign-in', async () => {
    const t = setup();
    const shared = await t.group(ALICE, 'Shared', BOB);
    const solo = await t.group(BOB, 'Solo');
    await t.call('PATCH /v1/me', BOB, {}, { displayName: 'Bob' });
    // Bob shares with Alice, who agreed: his departure notifies her, as with any leave.
    await t.call(
      'PUT /v1/groups/{groupId}/accountability/sharing',
      BOB,
      { groupId: shared },
      {
        mode: 'EVERYONE',
        recipientIds: [],
      },
    );
    await t.call('PUT /v1/groups/{groupId}/accountability/senders/{userId}', ALICE, {
      groupId: shared,
      userId: BOB,
    });

    expect((await t.call('DELETE /v1/me', BOB, {})).status).toBe(204);
    expect(t.deleted).toEqual([BOB]);
    expect(await t.store.getProfile(BOB)).toBeNull();
    expect(await t.store.getMembership(shared, BOB)).toBeNull();
    expect(await t.store.getGroup(solo)).toBeNull();
    expect(await t.store.getGroup(shared)).not.toBeNull(); // Alice's group lives on
    expect(t.store.outboxItems()).toEqual([
      expect.objectContaining({ kind: 'GROUP_DEPARTURE', senderId: BOB, recipientIds: [ALICE] }),
    ]);
  });

  it('refuses while the user is the only admin of a group with other members', async () => {
    const t = setup();
    const shared = await t.group(ALICE, 'Shared', BOB);
    expect((await t.call('DELETE /v1/me', ALICE, {})).status).toBe(409);
    expect(t.deleted).toEqual([]);
    expect(await t.store.getMembership(shared, ALICE)).not.toBeNull();

    // After handing over admin, deletion works.
    await t.call(
      'PATCH /v1/groups/{groupId}/members/{userId}',
      ALICE,
      { groupId: shared, userId: BOB },
      {
        role: 'ADMIN',
      },
    );
    expect((await t.call('DELETE /v1/me', ALICE, {})).status).toBe(204);
    expect(await t.store.getMembership(shared, ALICE)).toBeNull();
  });

  it('refuses the deleted account\u2019s still-valid tokens afterwards', async () => {
    const t = setup();
    await t.call('PATCH /v1/me', BOB, {}, { displayName: 'Bob' });
    expect((await t.call('DELETE /v1/me', BOB, {})).status).toBe(204);
    expect((await t.call('PATCH /v1/me', BOB, {}, { displayName: 'Back' })).status).toBe(401);
    expect(await t.store.getProfile(BOB)).toBeNull();
  });

  it('keeps a solo group someone else joined meanwhile', async () => {
    const t = setup();
    const solo = await t.group(BOB, 'Solo');
    // Alice joins after Bob's deletion planned to dissolve (simulated: the group is no longer solo).
    const store = t.store;
    const original = store.dissolveGroup.bind(store);
    store.dissolveGroup = async (groupId, actorId, options) => {
      const inv = createdInvitationSchema.parse(
        (await t.call('POST /v1/groups/{groupId}/invitations', BOB, { groupId }, {})).body,
      );
      await t.call('POST /v1/invitations/accept', ALICE, {}, { token: inv.token });
      store.dissolveGroup = original;
      return original(groupId, actorId, options);
    };
    expect((await t.call('DELETE /v1/me', BOB, {})).status).toBe(409);
    expect(await t.store.getGroup(solo)).not.toBeNull();
  });

  it('is unavailable where accounts cannot be deleted', async () => {
    const t = setup({ canDelete: false });
    expect((await t.call('DELETE /v1/me', BOB, {})).status).toBe(500);
  });
});
