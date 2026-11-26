/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  addedDomainSchema,
  domainAuditListSchema,
  createdInvitationSchema,
  groupDomainListSchema,
  groupSummarySchema,
  ruleSnapshotSchema,
} from '@resolve/contracts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from './env';
import { createHandler } from './http';
import { createLogger } from './logger';
import { createRouter, createRoutes } from './routes';
import { createMemoryStore } from './store/memory';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const OUTSIDER = '33333333-3333-4333-8333-333333333333';
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
  vi.stubEnv('RULES_CLIENT_IDS', 'ext-client');
});

async function setup() {
  const store = createMemoryStore();
  const handler = createHandler(
    'test',
    createRouter(createRoutes({ env, store, now: () => new Date('2026-11-25T10:30:00Z') })),
    createLogger('error', () => undefined),
  );
  async function call(
    routeKey: string,
    user: string,
    params: Record<string, string> = {},
    body?: unknown,
    query?: Record<string, string>,
    clientId = 'web-client',
  ) {
    const event = {
      routeKey,
      headers: {},
      body: body === undefined ? undefined : JSON.stringify(body),
      isBase64Encoded: false,
      pathParameters: params,
      queryStringParameters: query,
      requestContext: {
        requestId: 'req-1',
        authorizer: {
          jwt: { claims: { sub: user, token_use: 'access', client_id: clientId } },
        },
      },
    } as unknown as APIGatewayProxyEventV2;
    const res = await handler(event);
    return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as unknown) : null };
  }
  const created = await call('POST /v1/groups', ADMIN, {}, { name: 'Group' });
  const groupId = groupSummarySchema.parse(created.body).groupId;
  const invite = createdInvitationSchema.parse(
    (await call('POST /v1/groups/{groupId}/invitations', ADMIN, { groupId }, {})).body,
  );
  await call('POST /v1/invitations/accept', MEMBER, {}, { token: invite.token });
  const add = (user: string, domain: string, type?: string) =>
    call('POST /v1/groups/{groupId}/domains', user, { groupId }, { domain, ...(type && { type }) });
  const list = async () =>
    groupDomainListSchema.parse(
      (await call('GET /v1/groups/{groupId}/domains', ADMIN, { groupId })).body,
    ).items;
  const rules = (user: string, query: Record<string, string> = {}, clientId = 'ext-client') =>
    call('GET /v1/extension/rules', user, {}, undefined, { groupId, ...query }, clientId);
  return { call, store, groupId, add, list, rules };
}

describe('member submissions', () => {
  it('adds additional domains immediately with a uniform response', async () => {
    const t = await setup();
    const first = await t.add(MEMBER, 'Bad.Example.');
    expect(first).toEqual({ status: 202, body: { message: 'Submission received.' } });
    expect(await t.list()).toEqual([
      {
        domain: 'bad.example',
        type: 'ADDITIONAL',
        addedBy: MEMBER,
        createdAt: '2026-11-25T10:30:00.000Z',
      },
    ]);
  });

  it('never reveals whether a domain is listed or in which category', async () => {
    const t = await setup();
    await t.add(ADMIN, 'secret.example', 'NON_NEGOTIABLE');
    const existing = await t.add(MEMBER, 'secret.example');
    const fresh = await t.add(MEMBER, 'fresh.example');
    expect(existing).toEqual(fresh);
    // The member submission did not downgrade or duplicate the admin entry.
    expect(await t.list()).toMatchObject([
      { domain: 'fresh.example', type: 'ADDITIONAL' },
      { domain: 'secret.example', type: 'NON_NEGOTIABLE' },
    ]);
  });

  it('gives the same generic rejection for invalid and essential domains', async () => {
    const t = await setup();
    const invalid = await t.add(MEMBER, 'https://bad.example/path');
    const essential = await t.add(MEMBER, 'mail.google.com');
    const suffix = await t.add(MEMBER, 'co.uk');
    expect(invalid.status).toBe(422);
    expect(essential).toEqual(invalid);
    expect(suffix).toEqual(invalid);
  });

  it('keeps members out of admin-only operations', async () => {
    const t = await setup();
    await t.add(ADMIN, 'x.example', 'NON_NEGOTIABLE');
    expect((await t.add(MEMBER, 'y.example', 'NON_NEGOTIABLE')).status).toBe(403);
    const { groupId } = t;
    expect((await t.call('GET /v1/groups/{groupId}/domains', MEMBER, { groupId })).status).toBe(
      403,
    );
    expect(
      (
        await t.call('DELETE /v1/groups/{groupId}/domains/{domain}', MEMBER, {
          groupId,
          domain: 'x.example',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await t.call(
          'PATCH /v1/groups/{groupId}/domains/{domain}',
          MEMBER,
          { groupId, domain: 'x.example' },
          { type: 'ADDITIONAL' },
        )
      ).status,
    ).toBe(403);
    expect((await t.add(OUTSIDER, 'z.example')).status).toBe(404);
  });

  it('rate-limits submissions per user per hour, charging duplicates too', async () => {
    const t = await setup();
    await t.add(ADMIN, 'known.example');
    for (let i = 0; i < 59; i++) {
      expect((await t.add(MEMBER, `d${String(i)}.example`)).status).toBe(202);
    }
    // A duplicate costs the same as a new domain, so the budget cannot reveal which it was.
    expect((await t.add(MEMBER, 'known.example')).status).toBe(202);
    expect((await t.add(MEMBER, 'fresh.example')).status).toBe(429);
  });

  it('answers members the same way when the list is full', async () => {
    const t = await setup();
    const fill = {
      groupId: t.groupId,
      type: 'ADDITIONAL' as const,
      addedBy: ADMIN,
      createdAt: '2026-11-25T10:30:00.000Z',
      maxDomains: 1,
    };
    await t.store.addDomain({ ...fill, domain: 'one.example' });
    expect(await t.store.addDomain({ ...fill, domain: 'two.example' })).toBe('full');
  });
});

describe('admin management', () => {
  it('adds with category, reports exemptions, and sees duplicates', async () => {
    const t = await setup();
    const added = await t.add(ADMIN, 'google.com', 'NON_NEGOTIABLE');
    expect(added.status).toBe(201);
    expect(addedDomainSchema.parse(added.body).exempted).toContain('Gmail');
    expect((await t.add(ADMIN, 'google.com')).status).toBe(409);
  });

  it('removes and reclassifies, bumping the rule version each time', async () => {
    const t = await setup();
    const { groupId } = t;
    await t.add(ADMIN, 'a.example');
    const v1 = ruleSnapshotSchema.parse((await t.rules(MEMBER)).body).ruleVersion;
    const patched = await t.call(
      'PATCH /v1/groups/{groupId}/domains/{domain}',
      ADMIN,
      { groupId, domain: 'a.example' },
      { type: 'NON_NEGOTIABLE' },
    );
    expect(patched.status).toBe(204);
    const v2 = ruleSnapshotSchema.parse((await t.rules(MEMBER)).body).ruleVersion;
    const del = { groupId, domain: 'a.example' };
    expect((await t.call('DELETE /v1/groups/{groupId}/domains/{domain}', ADMIN, del)).status).toBe(
      204,
    );
    expect((await t.call('DELETE /v1/groups/{groupId}/domains/{domain}', ADMIN, del)).status).toBe(
      404,
    );
    const v3 = ruleSnapshotSchema.parse((await t.rules(MEMBER)).body).ruleVersion;
    expect([v1, v2, v3]).toEqual([1, 2, 3]);
    expect(
      (
        await t.call('DELETE /v1/groups/{groupId}/domains/{domain}', ADMIN, {
          groupId,
          domain: 'A.Example',
        })
      ).status,
    ).toBe(404);
  });

  it('enforces the per-group quota', async () => {
    const t = await setup();
    const input = {
      groupId: t.groupId,
      type: 'ADDITIONAL' as const,
      addedBy: ADMIN,
      createdAt: '2026-11-25T10:30:00.000Z',
      maxDomains: 1,
    };
    expect(await t.store.addDomain({ ...input, domain: 'one.example' })).toBe('added');
    expect(await t.store.addDomain({ ...input, domain: 'two.example' })).toBe('full');
  });
});

describe('audit', () => {
  it('records who added, reclassified and removed each domain', async () => {
    const t = await setup();
    const { groupId } = t;
    await t.add(MEMBER, 'a.example');
    await t.call(
      'PATCH /v1/groups/{groupId}/domains/{domain}',
      ADMIN,
      { groupId, domain: 'a.example' },
      { type: 'NON_NEGOTIABLE' },
    );
    await t.call('DELETE /v1/groups/{groupId}/domains/{domain}', ADMIN, {
      groupId,
      domain: 'a.example',
    });
    const audit = await t.call('GET /v1/groups/{groupId}/domains/audit', ADMIN, { groupId });
    expect(domainAuditListSchema.parse(audit.body).items.map((e) => [e.action, e.actorId])).toEqual(
      [
        ['REMOVED', ADMIN],
        ['RECLASSIFIED', ADMIN],
        ['ADDED', MEMBER],
      ],
    );
    expect(
      (await t.call('GET /v1/groups/{groupId}/domains/audit', MEMBER, { groupId })).status,
    ).toBe(403);
  });
});

describe('extension rules', () => {
  it('refuses dashboard tokens so the standard API never enumerates the list', async () => {
    const t = await setup();
    expect((await t.rules(MEMBER, {}, 'web-client')).status).toBe(403);
    expect((await t.rules(ADMIN, {}, 'web-client')).status).toBe(403);
  });

  it('serves a versioned snapshot to active members only', async () => {
    const t = await setup();
    await t.add(ADMIN, 'nn.example', 'NON_NEGOTIABLE');
    await t.add(MEMBER, 'add.example');
    const snapshot = ruleSnapshotSchema.parse((await t.rules(MEMBER)).body);
    expect(snapshot).toMatchObject({
      status: 'current',
      ruleVersion: 2,
      nonNegotiable: ['nn.example'],
      additional: ['add.example'],
    });
    if (snapshot.status !== 'current') throw new Error('expected current');
    expect(snapshot.essential).toContain('youtube.com');

    const same = await t.rules(MEMBER, {
      version: '2',
      essentialVersion: snapshot.essentialVersion,
    });
    expect(ruleSnapshotSchema.parse(same.body).status).toBe('unchanged');
    expect(ruleSnapshotSchema.parse((await t.rules(MEMBER, { version: '1' })).body).status).toBe(
      'current',
    );

    expect((await t.rules(OUTSIDER)).status).toBe(404);
    await t.call('POST /v1/groups/{groupId}/leave', MEMBER, { groupId: t.groupId });
    expect((await t.rules(MEMBER)).status).toBe(404);
  });
});
