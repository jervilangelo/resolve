/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  apiErrorResponseSchema,
  groupIdSchema,
  groupListSchema,
  groupSummarySchema,
  profileSchema,
} from '@resolve/contracts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from './env';
import { createHandler } from './http';
import { createLogger } from './logger';
import { createRouter, createRoutes, generateGroupId } from './routes';
import { createMemoryStore } from './store/memory';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
/** Real Cognito subject format: version nibble 7, non-RFC variant nibble f. */
const COGNITO_SUB = '019a8f3e-7c1d-7a2b-fc3d-4e5f60718293';
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
  vi.stubEnv('ALLOWED_CLIENT_IDS', env.ALLOWED_CLIENT_IDS.join(','));
});

interface Call {
  user?: string;
  clientId?: string;
  tokenUse?: string;
  body?: unknown;
  rawBody?: string;
  groupId?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}

function setup() {
  const store = createMemoryStore();
  const handler = createHandler(
    'test',
    createRouter(createRoutes({ env, store, now: () => new Date('2026-11-23T00:00:00Z') })),
    createLogger('error', () => undefined),
  );
  async function call(routeKey: string, options: Call = {}) {
    const claims = options.user
      ? {
          sub: options.user,
          token_use: options.tokenUse ?? 'access',
          client_id: options.clientId ?? 'web-client',
        }
      : undefined;
    const event = {
      routeKey,
      headers: options.headers ?? {},
      body:
        options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
      isBase64Encoded: false,
      pathParameters: options.groupId ? { groupId: options.groupId } : undefined,
      queryStringParameters: options.query,
      requestContext: { requestId: 'req-1', ...(claims && { authorizer: { jwt: { claims } } }) },
    } as unknown as APIGatewayProxyEventV2;
    const res = await handler(event);
    return { status: res.statusCode, body: JSON.parse(res.body ?? 'null') as unknown };
  }
  return { call };
}

describe('authentication', () => {
  it('serves health without a token', async () => {
    const { call } = setup();
    expect(await call('GET /v1/health')).toEqual({
      status: 200,
      body: { status: 'ok', service: 'resolve-api', stage: 'test' },
    });
  });

  it.each([
    ['no token', {}],
    ['an ID token', { user: ALICE, tokenUse: 'id' }],
    ['an unknown app client', { user: ALICE, clientId: 'other' }],
    ['a non-UUID subject', { user: 'admin' }],
  ])('rejects %s with 401', async (_label, options) => {
    const { call } = setup();
    const res = await call('GET /v1/me', options);
    expect(res.status).toBe(401);
    expect(apiErrorResponseSchema.parse(res.body).error.code).toBe('UNAUTHENTICATED');
  });

  it('accepts real Cognito subject identifiers', async () => {
    const { call } = setup();
    expect((await call('GET /v1/me', { user: COGNITO_SUB })).status).toBe(200);
  });

  it('returns 404 for unknown routes', async () => {
    const { call } = setup();
    expect((await call('DELETE /v1/everything', { user: ALICE })).status).toBe(404);
  });
});

describe('profile', () => {
  it('reads defaults, then updates the display name', async () => {
    const { call } = setup();
    expect(profileSchema.parse((await call('GET /v1/me', { user: ALICE })).body)).toEqual({
      userId: ALICE,
      displayName: null,
    });
    const patched = await call('PATCH /v1/me', {
      user: ALICE,
      body: { displayName: '  Jonathan ' },
    });
    expect(patched).toEqual({ status: 200, body: { userId: ALICE, displayName: 'Jonathan' } });
    expect((await call('GET /v1/me', { user: ALICE })).body).toEqual(patched.body);
  });

  it.each([
    ['unknown fields', { displayName: 'A', admin: true }],
    ['markup', { displayName: '<script>' }],
    ['an empty name', { displayName: '   ' }],
    ['an overlong name', { displayName: 'x'.repeat(61) }],
  ])('rejects %s with 422', async (_label, body) => {
    const { call } = setup();
    expect((await call('PATCH /v1/me', { user: ALICE, body })).status).toBe(422);
  });

  it('rejects malformed JSON without echoing it', async () => {
    const { call } = setup();
    const res = await call('PATCH /v1/me', { user: ALICE, rawBody: '{"displayName": "leak' });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).not.toContain('leak');
  });
});

describe('groups', () => {
  it('creates a group with the creator as admin', async () => {
    const { call } = setup();
    const res = await call('POST /v1/groups', { user: ALICE, body: { name: 'Brothers' } });
    expect(res.status).toBe(201);
    const group = groupSummarySchema.parse(res.body);
    expect(group).toMatchObject({
      name: 'Brothers',
      role: 'ADMIN',
      createdAt: '2026-11-23T00:00:00.000Z',
    });
    const list = groupListSchema.parse((await call('GET /v1/groups', { user: ALICE })).body);
    expect(list.items).toEqual([group]);
  });

  it('replays an idempotent create instead of duplicating it', async () => {
    const { call } = setup();
    const headers = { 'idempotency-key': 'retry-key-0000000001' };
    const first = await call('POST /v1/groups', { user: ALICE, body: { name: 'A' }, headers });
    const second = await call('POST /v1/groups', { user: ALICE, body: { name: 'A' }, headers });
    expect([first.status, second.status]).toEqual([201, 200]);
    expect(second.body).toEqual(first.body);
    expect(
      groupListSchema.parse((await call('GET /v1/groups', { user: ALICE })).body).items,
    ).toHaveLength(1);
  });

  it('rejects an invalid idempotency key', async () => {
    const { call } = setup();
    const res = await call('POST /v1/groups', {
      user: ALICE,
      body: { name: 'A' },
      headers: { 'idempotency-key': 'short' },
    });
    expect(res.status).toBe(422);
  });

  it('hides groups from non-members with the same 404 as missing groups', async () => {
    const { call } = setup();
    const created = groupSummarySchema.parse(
      (await call('POST /v1/groups', { user: ALICE, body: { name: 'Private' } })).body,
    );
    expect(
      (await call('GET /v1/groups/{groupId}', { user: ALICE, groupId: created.groupId })).status,
    ).toBe(200);

    const asBob = await call('GET /v1/groups/{groupId}', { user: BOB, groupId: created.groupId });
    const missing = await call('GET /v1/groups/{groupId}', {
      user: BOB,
      groupId: generateGroupId(),
    });
    const malformed = await call('GET /v1/groups/{groupId}', { user: BOB, groupId: 'grp_../../x' });
    expect([asBob.status, missing.status, malformed.status]).toEqual([404, 404, 404]);
    expect(asBob.body).toEqual(missing.body);
    expect(groupListSchema.parse((await call('GET /v1/groups', { user: BOB })).body).items).toEqual(
      [],
    );
  });

  it('paginates with opaque cursors that cannot be reused by another user', async () => {
    const { call } = setup();
    for (const name of ['A', 'B', 'C'])
      await call('POST /v1/groups', { user: ALICE, body: { name } });
    const first = groupListSchema.parse(
      (await call('GET /v1/groups', { user: ALICE, query: { limit: '2' } })).body,
    );
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const cursor = first.nextCursor ?? '';
    const second = groupListSchema.parse(
      (await call('GET /v1/groups', { user: ALICE, query: { limit: '2', cursor } })).body,
    );
    expect(second).toMatchObject({ nextCursor: null });
    expect(second.items).toHaveLength(1);
    expect((await call('GET /v1/groups', { user: BOB, query: { cursor } })).status).toBe(422);
    expect((await call('GET /v1/groups', { user: ALICE, query: { limit: '500' } })).status).toBe(
      422,
    );
  });

  it('generates well-formed, unique group IDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateGroupId));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(groupIdSchema.safeParse(id).success).toBe(true);
  });
});
