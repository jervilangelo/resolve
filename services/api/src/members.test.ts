/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  createdInvitationSchema,
  groupSummarySchema,
  invitationListSchema,
  invitationPreviewSchema,
  memberListSchema,
} from '@resolve/contracts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from './env';
import { createHandler } from './http';
import { createLogger } from './logger';
import { createRouter, createRoutes, hashToken } from './routes';
import { createMemoryStore } from './store/memory';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';
const env: ApiEnv = {
  STAGE: 'test',
  LOG_LEVEL: 'error',
  TABLE_NAME: 'resolve-test',
  ALLOWED_CLIENT_IDS: ['web-client'],
};

beforeEach(() => {
  vi.stubEnv('STAGE', env.STAGE);
  vi.stubEnv('TABLE_NAME', env.TABLE_NAME);
  vi.stubEnv('ALLOWED_CLIENT_IDS', 'web-client');
});

function setup() {
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
    params: Record<string, string> = {},
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
  async function createGroup(user = ALICE) {
    const res = await call('POST /v1/groups', user, {}, { name: 'Brothers' });
    return groupSummarySchema.parse(res.body).groupId;
  }
  async function invite(groupId: string, maxUses?: number) {
    const res = await call(
      'POST /v1/groups/{groupId}/invitations',
      ALICE,
      { groupId },
      maxUses === undefined ? {} : { maxUses },
    );
    expect(res.status).toBe(201);
    return createdInvitationSchema.parse(res.body);
  }
  const accept = (token: string, user: string) =>
    call('POST /v1/invitations/accept', user, {}, { token });
  const members = (groupId: string, user: string) =>
    call('GET /v1/groups/{groupId}/members', user, { groupId });
  return {
    call,
    createGroup,
    invite,
    accept,
    members,
    store,
    advance: (ms: number) => {
      clock = new Date(clock.getTime() + ms);
    },
  };
}

describe('invitations', () => {
  it('lets an invitee preview and join as a member, once', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    const { token, expiresAt } = await t.invite(groupId);
    expect(expiresAt).toBe('2026-12-01T00:00:00.000Z');

    const preview = await t.call('POST /v1/invitations/preview', BOB, {}, { token });
    expect(invitationPreviewSchema.parse(preview.body)).toEqual({
      groupName: 'Brothers',
      expiresAt,
    });

    const joined = await t.accept(token, BOB);
    expect(joined.status).toBe(201);
    expect(groupSummarySchema.parse(joined.body).role).toBe('MEMBER');

    // Single use: a second person cannot reuse the link, and the preview is gone.
    expect((await t.accept(token, CAROL)).status).toBe(404);
    expect((await t.call('POST /v1/invitations/preview', CAROL, {}, { token })).status).toBe(404);
  });

  it('treats an existing member accepting again as a no-op that does not consume a use', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    const { token } = await t.invite(groupId, 2);
    expect((await t.accept(token, ALICE)).status).toBe(200);
    expect((await t.accept(token, BOB)).status).toBe(201);
    expect((await t.accept(token, CAROL)).status).toBe(201);
  });

  it('stores only a hash of the token and rejects expired, revoked and malformed tokens', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    const first = await t.invite(groupId);
    expect(await t.store.findInvitation(first.token, '2026-11-24T00:00:00.000Z')).toBeNull();
    expect(
      await t.store.findInvitation(hashToken(first.token), '2026-11-24T00:00:00.000Z'),
    ).not.toBeNull();

    const second = await t.invite(groupId);
    const listed = invitationListSchema.parse(
      (await t.call('GET /v1/groups/{groupId}/invitations', ALICE, { groupId })).body,
    );
    expect(listed.items.map((i) => i.invitationId).sort()).toEqual(
      [first.invitationId, second.invitationId].sort(),
    );
    expect(JSON.stringify(listed)).not.toContain(first.token);

    const revoked = await t.call('DELETE /v1/groups/{groupId}/invitations/{invitationId}', ALICE, {
      groupId,
      invitationId: second.invitationId,
    });
    expect(revoked.status).toBe(204);
    expect((await t.accept(second.token, BOB)).status).toBe(404);

    t.advance(8 * 86_400_000);
    expect((await t.accept(first.token, BOB)).status).toBe(404);
    expect((await t.accept('not-a-token', BOB)).status).toBe(422);
  });

  it('refuses to join a full group without consuming the invitation', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    const { token } = await t.invite(groupId);
    const result = await t.store.acceptInvitation(
      hashToken(token),
      BOB,
      '2026-11-24T00:00:00.000Z',
      1,
    );
    expect(result).toEqual({ status: 'full' });
    expect((await t.accept(token, BOB)).status).toBe(201);
  });
});

describe('role matrix', () => {
  it('lets members read the directory but not manage invitations or members', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    await t.call('PATCH /v1/me', BOB, {}, { displayName: 'Bob' });
    await t.accept((await t.invite(groupId)).token, BOB);

    const list = memberListSchema.parse((await t.members(groupId, BOB)).body);
    expect(list.items.map((m) => [m.userId, m.role, m.displayName])).toEqual([
      [ALICE, 'ADMIN', null],
      [BOB, 'MEMBER', 'Bob'],
    ]);

    expect(
      (await t.call('POST /v1/groups/{groupId}/invitations', BOB, { groupId }, {})).status,
    ).toBe(403);
    expect((await t.call('GET /v1/groups/{groupId}/invitations', BOB, { groupId })).status).toBe(
      403,
    );
    expect(
      (
        await t.call('DELETE /v1/groups/{groupId}/members/{userId}', BOB, {
          groupId,
          userId: ALICE,
        })
      ).status,
    ).toBe(403);
  });

  it('hides everything from non-members behind 404', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    expect((await t.members(groupId, CAROL)).status).toBe(404);
    expect((await t.call('POST /v1/groups/{groupId}/leave', CAROL, { groupId })).status).toBe(404);
    expect(
      (await t.call('POST /v1/groups/{groupId}/invitations', CAROL, { groupId }, {})).status,
    ).toBe(404);
  });
});

describe('leaving and removal', () => {
  it('lets members leave and admins remove members', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    await t.accept((await t.invite(groupId)).token, BOB);
    await t.accept((await t.invite(groupId)).token, CAROL);

    expect((await t.call('POST /v1/groups/{groupId}/leave', BOB, { groupId })).status).toBe(204);
    expect((await t.members(groupId, BOB)).status).toBe(404);

    const removed = await t.call('DELETE /v1/groups/{groupId}/members/{userId}', ALICE, {
      groupId,
      userId: CAROL,
    });
    expect(removed.status).toBe(204);
    const list = memberListSchema.parse((await t.members(groupId, ALICE)).body);
    expect(list.items.map((m) => m.userId)).toEqual([ALICE]);
    expect(
      (
        await t.call('DELETE /v1/groups/{groupId}/members/{userId}', ALICE, {
          groupId,
          userId: CAROL,
        })
      ).status,
    ).toBe(404);
  });

  it('never leaves a group without an admin', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    expect((await t.call('POST /v1/groups/{groupId}/leave', ALICE, { groupId })).status).toBe(409);
    expect(
      (
        await t.call('DELETE /v1/groups/{groupId}/members/{userId}', ALICE, {
          groupId,
          userId: ALICE,
        })
      ).status,
    ).toBe(409);
    expect((await t.members(groupId, ALICE)).status).toBe(200);
  });

  it('does not let a removed member rejoin with the same multi-use link', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    const { token } = await t.invite(groupId, 5);
    expect((await t.accept(token, BOB)).status).toBe(201);
    await t.call('DELETE /v1/groups/{groupId}/members/{userId}', ALICE, { groupId, userId: BOB });
    expect((await t.accept(token, BOB)).status).toBe(404);
    expect((await t.accept(token, CAROL)).status).toBe(201);
  });

  it('lets a former member rejoin with a new invitation', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    await t.accept((await t.invite(groupId)).token, BOB);
    await t.call('POST /v1/groups/{groupId}/leave', BOB, { groupId });
    expect((await t.accept((await t.invite(groupId)).token, BOB)).status).toBe(201);
  });
});

describe('ownership and group settings', () => {
  const role = (
    t: ReturnType<typeof setup>,
    groupId: string,
    user: string,
    actor: string,
    to: string,
  ) =>
    t.call(
      'PATCH /v1/groups/{groupId}/members/{userId}',
      actor,
      { groupId, userId: user },
      { role: to },
    );

  it('transfers ownership: promote a member, then the original admin can leave', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    await t.accept((await t.invite(groupId)).token, BOB);
    expect((await role(t, groupId, BOB, ALICE, 'ADMIN')).status).toBe(204);
    expect((await t.call('POST /v1/groups/{groupId}/leave', ALICE, { groupId })).status).toBe(204);
    const list = memberListSchema.parse((await t.members(groupId, BOB)).body);
    expect(list.items.map((m) => [m.userId, m.role])).toEqual([[BOB, 'ADMIN']]);
  });

  it('keeps at least one admin and lets admins step down only when another remains', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    await t.accept((await t.invite(groupId)).token, BOB);
    expect((await role(t, groupId, ALICE, ALICE, 'MEMBER')).status).toBe(409);
    await role(t, groupId, BOB, ALICE, 'ADMIN');
    expect((await role(t, groupId, ALICE, ALICE, 'MEMBER')).status).toBe(204);
    expect((await role(t, groupId, BOB, BOB, 'MEMBER')).status).toBe(409);
  });

  it('only admins change roles; members cannot promote themselves', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    await t.accept((await t.invite(groupId)).token, BOB);
    expect((await role(t, groupId, BOB, BOB, 'ADMIN')).status).toBe(403);
    expect((await role(t, groupId, ALICE, BOB, 'MEMBER')).status).toBe(403);
    expect((await role(t, groupId, CAROL, ALICE, 'ADMIN')).status).toBe(404);
    expect((await role(t, groupId, BOB, ALICE, 'OWNER')).status).toBe(422);
  });

  it('renames a group for every member', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    await t.accept((await t.invite(groupId)).token, BOB);
    const renamed = await t.call(
      'PATCH /v1/groups/{groupId}',
      ALICE,
      { groupId },
      { name: 'Renamed' },
    );
    expect(groupSummarySchema.parse(renamed.body).name).toBe('Renamed');
    const bobList = await t.call('GET /v1/groups', BOB);
    expect(JSON.stringify(bobList.body)).toContain('Renamed');
    expect(
      (await t.call('PATCH /v1/groups/{groupId}', BOB, { groupId }, { name: 'Mine' })).status,
    ).toBe(403);
    expect(
      (await t.call('PATCH /v1/groups/{groupId}', ALICE, { groupId }, { name: '' })).status,
    ).toBe(422);
  });

  it('dissolves a group for everyone; members cannot', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    const { token } = await t.invite(groupId, 3);
    await t.accept(token, BOB);
    expect((await t.call('DELETE /v1/groups/{groupId}', BOB, { groupId })).status).toBe(403);
    expect((await t.call('DELETE /v1/groups/{groupId}', ALICE, { groupId })).status).toBe(204);
    expect((await t.call('GET /v1/groups/{groupId}', ALICE, { groupId })).status).toBe(404);
    expect((await t.members(groupId, BOB)).status).toBe(404);
    expect((await t.accept(token, CAROL)).status).toBe(404);
    expect(JSON.stringify((await t.call('GET /v1/groups', BOB)).body)).not.toContain(groupId);
  });
});

describe('review regressions', () => {
  it('never lets anyone promote themselves, even a just-demoted admin', async () => {
    const t = setup();
    const groupId = await t.createGroup();
    await t.accept((await t.invite(groupId)).token, BOB);
    expect(await t.store.changeRole(groupId, BOB, 'ADMIN', BOB)).toBe('not_allowed');
    await t.store.changeRole(groupId, BOB, 'ADMIN', ALICE);
    await t.store.changeRole(groupId, ALICE, 'MEMBER', BOB);
    expect(await t.store.changeRole(groupId, ALICE, 'ADMIN', ALICE)).toBe('not_allowed');
  });

  it('answers a replayed create for a since-dissolved group with 404', async () => {
    const t = setup();
    const headers = { 'idempotency-key': 'replay-key-000000000001' };
    const first = await t.store.createGroup({
      groupId: 'grp_aaaaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'Replay',
      ownerId: ALICE,
      createdAt: '2026-11-24T00:00:00.000Z',
      idempotencyKey: headers['idempotency-key'],
    });
    await t.store.dissolveGroup(first.groupId, ALICE);
    const replay = await t.store.createGroup({
      groupId: 'grp_bbbbbbbbbbbbbbbbbbbbbbbbbb',
      name: 'Replay',
      ownerId: ALICE,
      createdAt: '2026-11-24T00:00:00.000Z',
      idempotencyKey: headers['idempotency-key'],
    });
    expect(replay).toEqual({ groupId: first.groupId, created: false });
    expect(await t.store.getGroup(first.groupId)).toBeNull();
  });
});
