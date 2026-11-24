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

/**
 * FR-19 / MASTER_PLAN §13-14.4: request data never reaches logs. Every request below carries
 * sensitive values (a blocked domain, a URL, a display name, an invitation token, a bearer
 * token); none of them may appear in any log line, at any level, for success or failure.
 */
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const DOMAIN = 'secret-site.example';
const URL_VALUE = 'https://secret-site.example/private/page?q=1';
const NAME = 'Very Private Name';
const BEARER = 'Bearer leaked-token-value';
const SECRETS = [DOMAIN, URL_VALUE, NAME, BEARER];

const env: ApiEnv = {
  STAGE: 'test',
  LOG_LEVEL: 'debug',
  TABLE_NAME: 'resolve-test',
  ALLOWED_CLIENT_IDS: ['web-client', 'ext-client'],
  RULES_CLIENT_IDS: ['ext-client'],
};

beforeEach(() => {
  vi.stubEnv('STAGE', env.STAGE);
  vi.stubEnv('TABLE_NAME', env.TABLE_NAME);
  vi.stubEnv('ALLOWED_CLIENT_IDS', 'web-client,ext-client');
});

describe('log privacy', () => {
  it('never logs request bodies, domains, URLs, names, tokens or invitation tokens', async () => {
    const lines: string[] = [];
    const handler = createHandler(
      'test',
      createRouter(createRoutes({ env, store: createMemoryStore() })),
      createLogger('debug', (line) => lines.push(line)),
    );
    const call = async (
      routeKey: string,
      user: string,
      params: Record<string, string>,
      body?: unknown,
      client = 'web-client',
    ) => {
      const res = await handler({
        routeKey,
        headers: { authorization: BEARER, referer: URL_VALUE },
        rawPath: '/v1/whatever/secret-site.example',
        body: body === undefined ? undefined : JSON.stringify(body),
        isBase64Encoded: false,
        pathParameters: params,
        requestContext: {
          requestId: 'req-1',
          http: { path: '/v1/x/secret-site.example', sourceIp: '203.0.113.9', userAgent: 'UA' },
          authorizer: { jwt: { claims: { sub: user, token_use: 'access', client_id: client } } },
        },
      } as unknown as APIGatewayProxyEventV2);
      return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as unknown) : null };
    };

    await call('PATCH /v1/me', ALICE, {}, { displayName: NAME });
    const created = await call('POST /v1/groups', ALICE, {}, { name: NAME });
    const groupId = groupSummarySchema.parse(created.body).groupId;
    const g = { groupId };
    const inv = createdInvitationSchema.parse(
      (await call('POST /v1/groups/{groupId}/invitations', ALICE, g, {})).body,
    );
    await call('POST /v1/invitations/accept', BOB, {}, { token: inv.token });
    // Successful and failing domain operations, including invalid input echoing the domain.
    await call('POST /v1/groups/{groupId}/domains', BOB, g, { domain: DOMAIN });
    await call('POST /v1/groups/{groupId}/domains', ALICE, g, {
      domain: DOMAIN,
      type: 'NON_NEGOTIABLE',
    });
    await call('POST /v1/groups/{groupId}/domains', ALICE, g, { domain: URL_VALUE });
    await call('DELETE /v1/groups/{groupId}/domains/{domain}', ALICE, {
      groupId,
      domain: DOMAIN,
    });
    // A Trigger A event carrying a forbidden URL field (rejected) and a valid one.
    await call('POST /v1/events', BOB, {}, { url: URL_VALUE, groupId }, 'ext-client');
    await call('PUT /v1/groups/{groupId}/accountability/sharing', BOB, g, {
      mode: 'EVERYONE',
      recipientIds: [],
    });
    await call('POST /v1/groups/{groupId}/leave', BOB, g);

    expect(lines.length).toBeGreaterThan(5); // requests really were logged
    const all = lines.join('\n');
    for (const secret of [...SECRETS, inv.token, 'leaked-token-value', '203.0.113.9']) {
      expect(all).not.toContain(secret);
    }
    // Only the allowlisted structure is ever written.
    const allowed = new Set([
      'level',
      'message',
      'correlationId',
      'route',
      'status',
      'durationMs',
      'errorCode',
      'errorName',
      'time',
    ]);
    for (const line of lines) {
      for (const key of Object.keys(JSON.parse(line) as object)) expect(allowed).toContain(key);
    }
  });
});
