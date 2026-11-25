/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  GetItemCommand,
  BatchWriteItemCommand,
  type BatchWriteItemCommandOutput,
  DynamoDBClient,
  QueryCommand,
  type WriteRequest,
} from '@aws-sdk/client-dynamodb';
import {
  apiErrorResponseSchema,
  addedDomainSchema,
  createdInvitationSchema,
  groupDomainListSchema,
  ruleSnapshotSchema,
  groupListSchema,
  groupSummarySchema,
  healthResponseSchema,
  memberListSchema,
  profileSchema,
  accountabilityViewSchema,
} from '@resolve/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * Phase 3 acceptance against a deployed stack: authenticated operations work and unauthorized
 * group access is rejected. Run with `pnpm integration` (loads Terraform outputs).
 */
const env = z
  .object({
    RESOLVE_STAGE: z.enum(['dev']),
    RESOLVE_API_ENDPOINT: z.url(),
    RESOLVE_USER_POOL_ID: z.string(),
    RESOLVE_INTEGRATION_TEST_CLIENT_ID: z.string(),
    RESOLVE_TABLE_NAME: z.string(),
  })
  .parse(process.env);

const cognito = new CognitoIdentityProviderClient({
  region: env.RESOLVE_USER_POOL_ID.split('_')[0] ?? 'ap-southeast-1',
});
const region = env.RESOLVE_USER_POOL_ID.split('_')[0] ?? 'ap-southeast-1';
const dynamo = new DynamoDBClient({ region });
const usernames: string[] = [];
/** DynamoDB keys created by this run, deleted in afterAll. */
const fixtures: { PK: string; SK: string }[] = [];

function subjectOf(token: string): string {
  const payload = token.split('.')[1] ?? '';
  return z
    .object({ sub: z.string() })
    .parse(JSON.parse(Buffer.from(payload, 'base64url').toString())).sub;
}

function trackGroup(groupId: string, ...members: string[]) {
  fixtures.push({ PK: `GROUP#${groupId}`, SK: 'META' });
  for (const token of members)
    fixtures.push({ PK: `GROUP#${groupId}`, SK: `MEMBER#${subjectOf(token)}` });
}

async function createUser(username = `it-${randomUUID()}@example.invalid`): Promise<string> {
  const password = `It-${randomBytes(18).toString('base64url')}9a`;
  usernames.push(username);
  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: env.RESOLVE_USER_POOL_ID,
      Username: username,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: username },
        { Name: 'email_verified', Value: 'true' },
      ],
    }),
  );
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: env.RESOLVE_USER_POOL_ID,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );
  const auth = await cognito.send(
    new AdminInitiateAuthCommand({
      UserPoolId: env.RESOLVE_USER_POOL_ID,
      ClientId: env.RESOLVE_INTEGRATION_TEST_CLIENT_ID,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }),
  );
  const token = auth.AuthenticationResult?.AccessToken;
  if (!token) throw new Error('No access token returned');
  fixtures.push({ PK: `USER#${subjectOf(token)}`, SK: 'PROFILE' });
  return token;
}

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${env.RESOLVE_API_ENDPOINT}${path}`, {
    method,
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as unknown) : null };
}

let alice = '';
let bob = '';
let carol = '';

beforeAll(async () => {
  [alice, bob, carol] = await Promise.all([createUser(), createUser(), createUser()]);
}, 60_000);

/** Tracks both invitation items (group-scoped record and hashed-token pointer) for cleanup. */
function trackInvitation(groupId: string, invitationId: string, token: string) {
  const hash = createHash('sha256').update(token).digest('hex');
  fixtures.push({ PK: `GROUP#${groupId}`, SK: `INVITE#${invitationId}` });
  fixtures.push({ PK: `INVITE#${hash}`, SK: 'INVITE' });
}

afterAll(async () => {
  // Polling helpers may register the same key more than once; batches must not repeat keys.
  const unique = [...new Map(fixtures.map((key) => [`${key.PK}|${key.SK}`, key])).values()];
  fixtures.splice(0, fixtures.length, ...unique);
  try {
    for (let i = 0; i < fixtures.length; i += 25) {
      let pending: Record<string, WriteRequest[]> | undefined = {
        [env.RESOLVE_TABLE_NAME]: fixtures.slice(i, i + 25).map((key) => ({
          DeleteRequest: { Key: { PK: { S: key.PK }, SK: { S: key.SK } } },
        })),
      };
      for (let attempt = 0; pending && Object.keys(pending).length > 0; attempt++) {
        if (attempt === 5) throw new Error('DynamoDB fixtures were not fully deleted');
        const result: BatchWriteItemCommandOutput = await dynamo.send(
          new BatchWriteItemCommand({ RequestItems: pending }),
        );
        pending = result.UnprocessedItems;
      }
    }
  } finally {
    await Promise.all(
      usernames.map((username) =>
        cognito
          .send(
            new AdminDeleteUserCommand({
              UserPoolId: env.RESOLVE_USER_POOL_ID,
              Username: username,
            }),
          )
          // Some tests delete their own account through the API.
          .catch((error: unknown) => {
            if (!(error instanceof UserNotFoundException)) throw error;
          }),
      ),
    );
  }
});

describe(`deployed API (${env.RESOLVE_STAGE})`, () => {
  it('serves health without authentication', async () => {
    const res = await api('GET', '/v1/health');
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body).stage).toBe('dev');
  });

  it('rejects missing and forged tokens at the gateway', async () => {
    expect((await api('GET', '/v1/me')).status).toBe(401);
    expect((await api('GET', '/v1/me', 'eyJhbGciOiJub25lIn0.e30.')).status).toBe(401);
  });

  it('rejects empty and foreign pagination cursors', async () => {
    expect((await api('GET', '/v1/groups?cursor=', alice)).status).toBe(422);
    const foreign = Buffer.from(
      JSON.stringify({ PK: 'GROUP#x', SK: 'MEMBER#y', GSI1PK: 'USER#y', GSI1SK: 'GROUP#x' }),
    ).toString('base64url');
    expect((await api('GET', `/v1/groups?cursor=${foreign}`, alice)).status).toBe(422);
  });

  it('reads and updates the caller profile', async () => {
    expect(profileSchema.parse((await api('GET', '/v1/me', alice)).body).displayName).toBeNull();
    const patched = await api('PATCH', '/v1/me', alice, { displayName: 'Integration Alice' });
    expect(patched.status).toBe(200);
    expect(profileSchema.parse((await api('GET', '/v1/me', alice)).body).displayName).toBe(
      'Integration Alice',
    );
  });

  it('creates a group and enforces membership on reads', async () => {
    const created = await api('POST', '/v1/groups', alice, { name: 'Integration group' });
    expect(created.status).toBe(201);
    const group = groupSummarySchema.parse(created.body);
    trackGroup(group.groupId, alice);
    expect(group.role).toBe('ADMIN');

    expect((await api('GET', `/v1/groups/${group.groupId}`, alice)).status).toBe(200);
    const list = groupListSchema.parse((await api('GET', '/v1/groups', alice)).body);
    expect(list.items.map((g) => g.groupId)).toContain(group.groupId);

    const asBob = await api('GET', `/v1/groups/${group.groupId}`, bob);
    expect(asBob.status).toBe(404);
    expect(apiErrorResponseSchema.parse(asBob.body).error.code).toBe('NOT_FOUND');
    expect(groupListSchema.parse((await api('GET', '/v1/groups', bob)).body).items).toEqual([]);
  });

  it('rejects invalid input with the error contract', async () => {
    const res = await api('POST', '/v1/groups', alice, { name: '', extra: true });
    expect(res.status).toBe(422);
    expect(apiErrorResponseSchema.parse(res.body).error.code).toBe('VALIDATION_FAILED');
  });
});

describe(`deployed membership lifecycle (${env.RESOLVE_STAGE})`, () => {
  it('invites, joins, lists, removes and leaves with role checks', async () => {
    const created = groupSummarySchema.parse(
      (await api('POST', '/v1/groups', alice, { name: 'Membership flow' })).body,
    );
    const groupId = created.groupId;
    trackGroup(groupId, alice, bob, carol);

    const invite = async () => {
      const res = await api('POST', `/v1/groups/${groupId}/invitations`, alice, {});
      expect(res.status).toBe(201);
      const inv = createdInvitationSchema.parse(res.body);
      trackInvitation(groupId, inv.invitationId, inv.token);
      return inv;
    };

    const first = await invite();
    expect((await api('POST', '/v1/invitations/preview', bob, { token: first.token })).status).toBe(
      200,
    );
    expect((await api('POST', '/v1/invitations/accept', bob, { token: first.token })).status).toBe(
      201,
    );
    // Single use, and members cannot manage the group.
    expect(
      (await api('POST', '/v1/invitations/accept', carol, { token: first.token })).status,
    ).toBe(404);
    expect((await api('POST', `/v1/groups/${groupId}/invitations`, bob, {})).status).toBe(403);

    const second = await invite();
    expect(
      (await api('POST', '/v1/invitations/accept', carol, { token: second.token })).status,
    ).toBe(201);

    const list = memberListSchema.parse(
      (await api('GET', `/v1/groups/${groupId}/members`, bob)).body,
    );
    expect(list.items.map((m) => m.role).sort()).toEqual(['ADMIN', 'MEMBER', 'MEMBER']);

    const carolId = subjectOf(carol);
    expect(
      (await api('DELETE', `/v1/groups/${groupId}/members/${subjectOf(alice)}`, bob)).status,
    ).toBe(403);
    expect((await api('DELETE', `/v1/groups/${groupId}/members/${carolId}`, alice)).status).toBe(
      204,
    );
    expect((await api('GET', `/v1/groups/${groupId}/members`, carol)).status).toBe(404);

    expect((await api('POST', `/v1/groups/${groupId}/leave`, bob)).status).toBe(204);
    expect((await api('POST', `/v1/groups/${groupId}/leave`, alice)).status).toBe(409);

    const remaining = memberListSchema.parse(
      (await api('GET', `/v1/groups/${groupId}/members`, alice)).body,
    );
    expect(remaining.items.map((m) => m.userId)).toEqual([subjectOf(alice)]);
  });
});

describe(`deployed ownership and dissolution (${env.RESOLVE_STAGE})`, () => {
  it('promotes, renames, transfers ownership and dissolves without leftovers', async () => {
    const created = groupSummarySchema.parse(
      (await api('POST', '/v1/groups', alice, { name: 'Ownership flow' })).body,
    );
    const groupId = created.groupId;
    trackGroup(groupId, alice, bob);
    const inv = createdInvitationSchema.parse(
      (await api('POST', `/v1/groups/${groupId}/invitations`, alice, { maxUses: 2 })).body,
    );
    trackInvitation(groupId, inv.invitationId, inv.token);
    await api('POST', '/v1/invitations/accept', bob, { token: inv.token });

    const bobId = subjectOf(bob);
    expect(
      (await api('PATCH', `/v1/groups/${groupId}/members/${bobId}`, alice, { role: 'ADMIN' }))
        .status,
    ).toBe(204);
    const renamed = await api('PATCH', `/v1/groups/${groupId}`, bob, { name: 'Renamed group' });
    expect(groupSummarySchema.parse(renamed.body).name).toBe('Renamed group');
    expect((await api('POST', `/v1/groups/${groupId}/leave`, alice)).status).toBe(204);
    expect((await api('POST', `/v1/groups/${groupId}/leave`, bob)).status).toBe(409);

    expect((await api('DELETE', `/v1/groups/${groupId}`, bob)).status).toBe(204);
    expect((await api('GET', `/v1/groups/${groupId}`, bob)).status).toBe(404);
    expect((await api('POST', '/v1/invitations/preview', carol, { token: inv.token })).status).toBe(
      404,
    );

    const left = await dynamo.send(
      new QueryCommand({
        TableName: env.RESOLVE_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': { S: `GROUP#${groupId}` } },
        ConsistentRead: true,
      }),
    );
    expect(left.Count).toBe(0);
  });
});

describe(`deployed domain protection (${env.RESOLVE_STAGE})`, () => {
  it('lets members submit without approval or oracle; only admins list, remove and reclassify', async () => {
    const created = groupSummarySchema.parse(
      (await api('POST', '/v1/groups', alice, { name: 'Domain flow' })).body,
    );
    const groupId = created.groupId;
    trackGroup(groupId, alice, bob);
    const hour = new Date().toISOString().slice(0, 13);
    for (const token of [alice, bob]) {
      fixtures.push({ PK: `USER#${subjectOf(token)}`, SK: `RATE#domains#${hour}` });
    }
    const inv = createdInvitationSchema.parse(
      (await api('POST', `/v1/groups/${groupId}/invitations`, alice, {})).body,
    );
    trackInvitation(groupId, inv.invitationId, inv.token);
    await api('POST', '/v1/invitations/accept', bob, { token: inv.token });

    const nn = await api('POST', `/v1/groups/${groupId}/domains`, alice, {
      domain: 'google.com',
      type: 'NON_NEGOTIABLE',
    });
    expect(nn.status).toBe(201);
    expect(addedDomainSchema.parse(nn.body).exempted).toContain('Gmail');

    const dup = await api('POST', `/v1/groups/${groupId}/domains`, bob, { domain: 'google.com' });
    const fresh = await api('POST', `/v1/groups/${groupId}/domains`, bob, {
      domain: 'Extra.Example',
    });
    expect(dup).toEqual(fresh);
    expect(fresh.status).toBe(202);
    expect(
      (
        await api('POST', `/v1/groups/${groupId}/domains`, bob, {
          domain: 'x.example',
          type: 'NON_NEGOTIABLE',
        })
      ).status,
    ).toBe(403);
    expect(
      (await api('POST', `/v1/groups/${groupId}/domains`, bob, { domain: 'youtube.com' })).status,
    ).toBe(422);
    expect((await api('GET', `/v1/groups/${groupId}/domains`, bob)).status).toBe(403);

    const list = groupDomainListSchema.parse(
      (await api('GET', `/v1/groups/${groupId}/domains`, alice)).body,
    );
    expect(list.items.map((d) => [d.domain, d.type])).toEqual([
      ['extra.example', 'ADDITIONAL'],
      ['google.com', 'NON_NEGOTIABLE'],
    ]);

    const rules = ruleSnapshotSchema.parse(
      (await api('GET', `/v1/extension/rules?groupId=${groupId}`, bob)).body,
    );
    expect(rules).toMatchObject({
      status: 'current',
      nonNegotiable: ['google.com'],
      additional: ['extra.example'],
    });
    const unchanged = ruleSnapshotSchema.parse(
      (
        await api(
          'GET',
          `/v1/extension/rules?groupId=${groupId}&version=${String(rules.ruleVersion)}&essentialVersion=${rules.essentialVersion}`,
          bob,
        )
      ).body,
    );
    expect(unchanged.status).toBe('unchanged');

    expect((await api('DELETE', `/v1/groups/${groupId}/domains/extra.example`, bob)).status).toBe(
      403,
    );
    expect((await api('DELETE', `/v1/groups/${groupId}/domains/extra.example`, alice)).status).toBe(
      204,
    );
    expect(
      (
        await api('PATCH', `/v1/groups/${groupId}/domains/google.com`, alice, {
          type: 'ADDITIONAL',
        })
      ).status,
    ).toBe(204);
    const after = ruleSnapshotSchema.parse(
      (await api('GET', `/v1/extension/rules?groupId=${groupId}`, bob)).body,
    );
    expect(after).toMatchObject({ nonNegotiable: [], additional: ['google.com'] });
    expect(after.ruleVersion).toBe(rules.ruleVersion + 2);
    expect((await api('GET', `/v1/extension/rules?groupId=${groupId}`, carol)).status).toBe(404);

    expect((await api('DELETE', `/v1/groups/${groupId}`, alice)).status).toBe(204);
  });
});

describe(`deployed accountability (${env.RESOLVE_STAGE})`, () => {
  it('keeps sharing private by default, needs recipient consent, and clears it on leave', async () => {
    const created = groupSummarySchema.parse(
      (await api('POST', '/v1/groups', alice, { name: 'Accountability flow' })).body,
    );
    const groupId = created.groupId;
    trackGroup(groupId, alice, bob, carol);
    for (const user of [bob, carol]) {
      const inv = createdInvitationSchema.parse(
        (await api('POST', `/v1/groups/${groupId}/invitations`, alice, {})).body,
      );
      trackInvitation(groupId, inv.invitationId, inv.token);
      expect((await api('POST', '/v1/invitations/accept', user, { token: inv.token })).status).toBe(
        201,
      );
    }
    const [aliceId, bobId, carolId] = [alice, bob, carol].map(subjectOf);
    const base = `/v1/groups/${groupId}/accountability`;
    const view = async (token: string) =>
      accountabilityViewSchema.parse((await api('GET', base, token)).body);

    expect((await view(bob)).sharing.mode).toBe('PRIVATE');

    // Bob shares with Carol only; Carol must agree before anything reaches her.
    expect(
      (await api('PUT', `${base}/sharing`, bob, { mode: 'SELECTED', recipientIds: [carolId] }))
        .status,
    ).toBe(200);
    expect((await view(carol)).senders).toEqual([
      expect.objectContaining({ userId: bobId, status: 'needs_consent' }),
    ]);
    expect((await view(alice)).senders).toEqual([]); // admins see nothing of it
    expect((await api('PUT', `${base}/senders/${bobId}`, carol)).status).toBe(200);
    expect((await view(bob)).recipients).toEqual([
      expect.objectContaining({ userId: carolId, status: 'receiving' }),
    ]);

    // EVERYONE + Alice accepting everyone; Carol withdraws.
    await api('PUT', `${base}/sharing`, bob, { mode: 'EVERYONE', recipientIds: [] });
    await api('PUT', `${base}/receiving`, alice, { acceptAll: true });
    await api('DELETE', `${base}/senders/${bobId}`, carol);
    const bobView = await view(bob);
    expect(bobView.recipients.find((r) => r.userId === aliceId)?.status).toBe('receiving');
    expect(bobView.recipients.find((r) => r.userId === carolId)?.status).toBe('awaiting');

    // Leaving deletes Bob's own sharing and consent items in the same transaction.
    expect((await api('POST', `/v1/groups/${groupId}/leave`, bob)).status).toBe(204);
    for (const SK of [`SHARE#${bobId}`, `CONSENT#${bobId}`]) {
      const item = await dynamo.send(
        new GetItemCommand({
          TableName: env.RESOLVE_TABLE_NAME,
          Key: { PK: { S: `GROUP#${groupId}` }, SK: { S: SK } },
          ConsistentRead: true,
        }),
      );
      expect(item.Item).toBeUndefined();
    }

    // Dissolving sweeps the rest (consent items and their audit records included).
    expect((await api('DELETE', `/v1/groups/${groupId}`, alice)).status).toBe(204);
  });
});

describe(`deployed alert triggers (${env.RESOLVE_STAGE})`, () => {
  it('delivers Trigger A and Trigger B alerts to a consenting recipient only', async () => {
    // The recipient's address is SES's success mailbox simulator, which sandbox mode allows.
    const recipient = await createUser(`success+it-${randomUUID()}@simulator.amazonses.com`);
    const outsider = await createUser();
    const created = groupSummarySchema.parse(
      (await api('POST', '/v1/groups', alice, { name: 'Alert flow' })).body,
    );
    const groupId = created.groupId;
    trackGroup(groupId, alice, bob, recipient, outsider);
    for (const user of [bob, recipient, outsider]) {
      const inv = createdInvitationSchema.parse(
        (await api('POST', `/v1/groups/${groupId}/invitations`, alice, {})).body,
      );
      trackInvitation(groupId, inv.invitationId, inv.token);
      await api('POST', '/v1/invitations/accept', user, { token: inv.token });
    }
    const bobId = subjectOf(bob);
    const recipientId = subjectOf(recipient);
    const outsiderId = subjectOf(outsider);
    const base = `/v1/groups/${groupId}/accountability`;
    await api('PUT', `${base}/sharing`, bob, { mode: 'EVERYONE', recipientIds: [] });
    await api('PUT', `${base}/receiving`, recipient, { acceptAll: true });
    // The outsider never consents: nothing may reach them.

    /** Alerts the worker charged to a user this hour (charged just before each send). */
    const alertCount = async (userId: string) => {
      const res = await dynamo.send(
        new QueryCommand({
          TableName: env.RESOLVE_TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :rate)',
          ExpressionAttributeValues: {
            ':pk': { S: `USER#${userId}` },
            ':rate': { S: 'RATE#alerts#' },
          },
          ConsistentRead: true,
        }),
      );
      for (const item of res.Items ?? []) {
        const sk = item.SK?.S;
        if (sk) fixtures.push({ PK: `USER#${userId}`, SK: sk });
      }
      return (res.Items ?? []).reduce((sum, item) => sum + Number(item.submissions?.N ?? 0), 0);
    };
    const waitForAlerts = async (userId: string, expected: number) => {
      for (let i = 0; i < 40; i++) {
        if ((await alertCount(userId)) >= expected) return alertCount(userId);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      return alertCount(userId);
    };

    // Trigger A: reported by the extension (this test client stands in for it outside prod).
    const eventId = `evt_${randomBytes(26)
      .toString('hex')
      .replace(/[^a-z2-7]/g, 'a')
      .slice(0, 26)}`;
    fixtures.push({ PK: `USER#${bobId}`, SK: `EVENT#${eventId}` });
    fixtures.push({ PK: `USER#${bobId}`, SK: `COOLDOWN#${groupId}` });
    const reported = await api('POST', '/v1/events', bob, {
      eventId,
      groupId,
      eventType: 'NON_NEGOTIABLE_NAVIGATION',
      occurredAt: new Date().toISOString(),
      clientRuleVersion: 0,
    });
    expect(reported).toEqual({ status: 202, body: { status: 'received' } });
    expect(await waitForAlerts(recipientId, 1)).toBe(1);

    // Trigger B: Bob leaves; the alert comes from his pre-departure sharing.
    expect((await api('POST', `/v1/groups/${groupId}/leave`, bob)).status).toBe(204);
    expect(await waitForAlerts(recipientId, 2)).toBe(2);
    expect(await alertCount(outsiderId)).toBe(0);
    expect((await api('DELETE', `/v1/groups/${groupId}`, alice)).status).toBe(204);
  }, 300_000);
});

describe(`deployed account deletion (${env.RESOLVE_STAGE})`, () => {
  it('deletes the account, its data and its sign-in, and refuses its remaining tokens', async () => {
    const user = await createUser();
    const userId = subjectOf(user);
    expect((await api('PATCH', '/v1/me', user, { displayName: 'Leaving' })).status).toBe(200);
    const solo = groupSummarySchema.parse(
      (await api('POST', '/v1/groups', user, { name: 'Solo group' })).body,
    );
    trackGroup(solo.groupId, user);
    fixtures.push({ PK: `USER#${userId}`, SK: 'DELETED' });

    expect((await api('DELETE', '/v1/me', user)).status).toBe(204);
    // The still-valid access token is refused (tombstone), the solo group is gone, the sign-in too.
    expect((await api('GET', '/v1/me', user)).status).toBe(401);
    const left = await dynamo.send(
      new QueryCommand({
        TableName: env.RESOLVE_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': { S: `GROUP#${solo.groupId}` } },
        ConsistentRead: true,
      }),
    );
    expect(left.Count).toBe(0);
    await expect(
      cognito.send(
        new AdminGetUserCommand({ UserPoolId: env.RESOLVE_USER_POOL_ID, Username: userId }),
      ),
    ).rejects.toBeInstanceOf(UserNotFoundException);
  });
});
