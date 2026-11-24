/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { DynamoDBClient, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { groupRoleSchema } from '@resolve/contracts';
import { z } from 'zod';
import {
  type AcceptResult,
  type CreateGroupInput,
  InvalidCursorError,
  type Page,
  type RemoveResult,
  type Store,
  type StoredInvitation,
  type StoredMember,
  type StoredGroup,
  type StoredMembership,
  type StoredProfile,
} from './store';

/**
 * Single-table layout (docs/MASTER_PLAN.md §10). Keys:
 *   USER#<sub>   PROFILE                      profile
 *   USER#<sub>   IDEMP#createGroup#<key>      idempotency record (TTL)
 *   GROUP#<id>   META                         group
 *   GROUP#<id>   MEMBER#<sub>                 membership; GSI1 = USER#<sub> / GROUP#<id>
 *   GROUP#<id>   INVITE#<invitationId>        invitation (token stored only as a hash; TTL)
 *   INVITE#<sha256(token)>  INVITE            token lookup pointer to the invitation (TTL)
 *   OUTBOX#<id>  OUTBOX                       notification outbox (relayed from the stream)
 */
export const keys = {
  user: (userId: string) => `USER#${userId}`,
  group: (groupId: string) => `GROUP#${groupId}`,
  member: (userId: string) => `MEMBER#${userId}`,
  invite: (invitationId: string) => `INVITE#${invitationId}`,
  token: (tokenHash: string) => `INVITE#${tokenHash}`,
  redemption: (invitationId: string, userId: string) => `REDEEMED#${invitationId}#${userId}`,
};

/** Invitation items outlive their expiry briefly so revocation and late clicks behave. */
const INVITE_TTL_GRACE_SECONDS = 24 * 60 * 60;
/** A dissolved group's META marker expires on its own if the cleanup sweep cannot finish. */
const DISSOLVED_MARKER_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Condition fragment: the group exists and has not been dissolved. */
const LIVE_GROUP = 'attribute_exists(PK) AND attribute_not_exists(dissolvedAt)';

const liveMetaSchema = z.object({
  PK: z.string(),
  name: z.string(),
  createdAt: z.string(),
  // Must be absent (z.undefined() would require the key to be present).
  dissolvedAt: z.never().optional(),
});

const invitationItemSchema = z.object({
  invitationId: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  maxUses: z.number(),
  uses: z.number(),
});

const memberItemSchema = z.object({ SK: z.string(), role: groupRoleSchema, joinedAt: z.string() });

const memberCursorSchema = z.strictObject({ PK: z.string(), SK: z.string() });

function ttlFor(expiresAt: string): number {
  return Math.floor(Date.parse(expiresAt) / 1000) + INVITE_TTL_GRACE_SECONDS;
}

function cancellationCodes(error: unknown): string[] | null {
  if (!(error instanceof TransactionCanceledException)) return null;
  return (error.CancellationReasons ?? []).map((reason) => reason.Code ?? 'None');
}

type TransactItems = NonNullable<
  ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']
>;

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const membershipItemSchema = z.object({
  PK: z.string(),
  SK: z.string(),
  role: groupRoleSchema,
  groupName: z.string(),
  groupCreatedAt: z.string(),
});

const cursorSchema = z.strictObject({
  PK: z.string(),
  SK: z.string(),
  GSI1PK: z.string(),
  GSI1SK: z.string(),
});

function encodeCursor(key: Record<string, unknown> | undefined): string | null {
  return key ? Buffer.from(JSON.stringify(key)).toString('base64url') : null;
}

function decodeCursor(cursor: string, userId: string): Record<string, unknown> {
  try {
    const key = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    // Must be a membership key of this caller, exactly as the index produces it.
    const valid =
      key.GSI1PK === keys.user(userId) &&
      key.SK === keys.member(userId) &&
      /^GROUP#grp_[a-z0-9]{26}$/.test(key.PK) &&
      key.GSI1SK === key.PK;
    if (!valid) throw new InvalidCursorError();
    return key;
  } catch {
    throw new InvalidCursorError();
  }
}

export function createDynamoStore(tableName: string, client = new DynamoDBClient({})): Store {
  const db = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  async function getMembership(groupId: string, userId: string): Promise<StoredMembership | null> {
    const { Item } = await db.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: keys.group(groupId), SK: keys.member(userId) },
        ConsistentRead: true,
      }),
    );
    if (!Item) return null;
    const item = membershipItemSchema.parse(Item);
    return {
      groupId,
      userId,
      role: item.role,
      groupName: item.groupName,
      groupCreatedAt: item.groupCreatedAt,
    };
  }

  /**
   * TransactWriteItems with bounded retries when DynamoDB cancels for a conflicting concurrent
   * transaction (e.g. two joins updating the same group). Condition failures are not retried.
   */
  async function transact(items: TransactItems): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        await db.send(new TransactWriteCommand({ TransactItems: items }));
        return;
      } catch (error) {
        const codes = cancellationCodes(error);
        const conflict = codes?.includes('TransactionConflict') ?? false;
        if (!conflict || attempt >= 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, 40 * 2 ** attempt + Math.random() * 40));
      }
    }
  }

  async function getItem(PK: string, SK: string) {
    const { Item } = await db.send(
      new GetCommand({ TableName: tableName, Key: { PK, SK }, ConsistentRead: true }),
    );
    return Item;
  }

  /** A usable (unexpired, not used up) invitation for a token hash, with its group. */
  async function findInvitation(tokenHash: string, now: string) {
    const ref = z
      .object({ groupId: z.string(), invitationId: z.string() })
      .safeParse(await getItem(keys.token(tokenHash), 'INVITE'));
    if (!ref.success) return null;
    const { groupId, invitationId } = ref.data;
    const [invite, group] = await Promise.all([
      getItem(keys.group(groupId), keys.invite(invitationId)),
      getItem(keys.group(groupId), 'META'),
    ]);
    const inv = invitationItemSchema.safeParse(invite);
    const meta = liveMetaSchema.safeParse(group);
    if (!inv.success || !meta.success) return null;
    if (inv.data.expiresAt <= now || inv.data.uses >= inv.data.maxUses) return null;
    return { ...inv.data, groupId, groupName: meta.data.name, groupCreatedAt: meta.data.createdAt };
  }

  /** Display names for up to 100 users (BatchGetItem limit), retrying unprocessed keys. */
  /** Transaction item asserting `actorId` is an admin of the group when the write commits. */
  function adminCheck(groupId: string, actorId: string): TransactItems[number] {
    return {
      ConditionCheck: {
        TableName: tableName,
        Key: { PK: keys.group(groupId), SK: keys.member(actorId) },
        ConditionExpression: '#role = :admin',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':admin': 'ADMIN' },
      },
    };
  }

  /** BatchGetItem for up to 100 keys, retrying unprocessed keys. */
  async function batchGet(itemKeys: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    const found: Record<string, unknown>[] = [];
    let keysLeft = itemKeys;
    for (let attempt = 0; keysLeft.length > 0 && attempt < 5; attempt++) {
      const result = await db.send(
        new BatchGetCommand({
          RequestItems: { [tableName]: { Keys: keysLeft, ConsistentRead: true } },
        }),
      );
      found.push(...(result.Responses?.[tableName] ?? []));
      keysLeft = result.UnprocessedKeys?.[tableName]?.Keys ?? [];
    }
    if (keysLeft.length > 0) throw new Error('BatchGetItem left keys unprocessed');
    return found;
  }

  /** Display names for up to 100 users. */
  async function displayNames(userIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const items = await batchGet(userIds.map((id) => ({ PK: keys.user(id), SK: 'PROFILE' })));
    for (const item of items) {
      const parsed = z.object({ PK: z.string(), displayName: z.string() }).safeParse(item);
      if (parsed.success) names.set(parsed.data.PK.slice('USER#'.length), parsed.data.displayName);
    }
    return names;
  }

  /** Every item in a group's partition, for dissolution. */
  async function groupPartition(groupId: string): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const page = await db.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': keys.group(groupId) },
          ConsistentRead: true,
          ExclusiveStartKey: start,
        }),
      );
      items.push(...(page.Items ?? []));
      start = page.LastEvaluatedKey;
    } while (start);
    return items;
  }

  /** BatchWriteItem deletes in chunks of 25, retrying unprocessed requests. */
  async function batchDelete(itemKeys: Record<string, unknown>[]): Promise<void> {
    for (let i = 0; i < itemKeys.length; i += 25) {
      let requests = itemKeys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } }));
      for (let attempt = 0; requests.length > 0; attempt++) {
        if (attempt >= 5) throw new Error('BatchWriteItem left deletes unprocessed');
        const result = await db.send(
          new BatchWriteCommand({ RequestItems: { [tableName]: requests } }),
        );
        requests = (result.UnprocessedItems?.[tableName] ?? []) as typeof requests;
        if (requests.length > 0) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      }
    }
  }

  return {
    async getProfile(userId) {
      const { Item } = await db.send(
        new GetCommand({ TableName: tableName, Key: { PK: keys.user(userId), SK: 'PROFILE' } }),
      );
      if (!Item) return null;
      const displayName: unknown = Item.displayName;
      return {
        displayName: typeof displayName === 'string' ? displayName : null,
      } satisfies StoredProfile;
    },

    async putProfile(userId, profile) {
      await db.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            PK: keys.user(userId),
            SK: 'PROFILE',
            type: 'Profile',
            displayName: profile.displayName,
            updatedAt: new Date().toISOString(),
          },
        }),
      );
    },

    async createGroup(input: CreateGroupInput) {
      const transactItems = [
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: keys.group(input.groupId),
              SK: 'META',
              type: 'Group',
              name: input.name,
              createdAt: input.createdAt,
              createdBy: input.ownerId,
              memberCount: 1,
              adminCount: 1,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: keys.group(input.groupId),
              SK: keys.member(input.ownerId),
              type: 'Membership',
              role: 'ADMIN',
              groupName: input.name,
              groupCreatedAt: input.createdAt,
              joinedAt: input.createdAt,
              GSI1PK: keys.user(input.ownerId),
              GSI1SK: keys.group(input.groupId),
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
      ];
      const idempotencyKey = input.idempotencyKey
        ? { PK: keys.user(input.ownerId), SK: `IDEMP#createGroup#${input.idempotencyKey}` }
        : undefined;
      if (idempotencyKey) {
        transactItems.push({
          Put: {
            TableName: tableName,
            Item: {
              ...idempotencyKey,
              type: 'Idempotency',
              groupId: input.groupId,
              ttl: Math.floor(Date.now() / 1000) + IDEMPOTENCY_TTL_SECONDS,
            } as never,
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        });
      }
      // Conflicting concurrent transactions (e.g. two retries with the same idempotency key)
      // are retried briefly; a lost race then resolves through the idempotency record.
      for (let attempt = 0; ; attempt++) {
        try {
          await db.send(new TransactWriteCommand({ TransactItems: transactItems }));
          return { groupId: input.groupId, created: true };
        } catch (error) {
          if (!(error instanceof TransactionCanceledException)) throw error;
          const reasons = error.CancellationReasons ?? [];
          if (reasons.some((r) => r.Code === 'TransactionConflict') && attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
            continue;
          }
          if (!idempotencyKey || reasons[2]?.Code !== 'ConditionalCheckFailed') throw error;
          const { Item } = await db.send(
            new GetCommand({ TableName: tableName, Key: idempotencyKey, ConsistentRead: true }),
          );
          const groupId = z.object({ groupId: z.string() }).parse(Item).groupId;
          return { groupId, created: false };
        }
      }
    },

    async getGroup(groupId) {
      const meta = liveMetaSchema.safeParse(await getItem(keys.group(groupId), 'META'));
      if (!meta.success) return null;
      return {
        groupId,
        name: meta.data.name,
        createdAt: meta.data.createdAt,
      } satisfies StoredGroup;
    },

    getMembership,

    async listMemberships(userId, limit, cursor): Promise<Page<StoredMembership>> {
      const { Items = [], LastEvaluatedKey } = await db.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :user AND begins_with(GSI1SK, :prefix)',
          ExpressionAttributeValues: { ':user': keys.user(userId), ':prefix': 'GROUP#' },
          Limit: limit,
          ExclusiveStartKey: cursor ? decodeCursor(cursor, userId) : undefined,
        }),
      );
      const memberships = Items.map((raw) => membershipItemSchema.parse(raw));
      // Names come from each group's META (renames need no fan-out); groups whose META is gone
      // (dissolved, cleanup pending) are skipped.
      const metas = await batchGet(memberships.map((m) => ({ PK: m.PK, SK: 'META' })));
      const names = new Map<string, string>();
      for (const meta of metas) {
        const parsed = liveMetaSchema.safeParse(meta);
        if (parsed.success) names.set(parsed.data.PK, parsed.data.name);
      }
      const items = memberships.flatMap((item) => {
        const name = names.get(item.PK);
        if (name === undefined) return [];
        return [
          {
            groupId: item.PK.slice('GROUP#'.length),
            userId,
            role: item.role,
            groupName: name,
            groupCreatedAt: item.groupCreatedAt,
          },
        ];
      });
      return { items, nextCursor: encodeCursor(LastEvaluatedKey) };
    },

    async listMembers(groupId, limit, cursor): Promise<Page<StoredMember>> {
      let start: Record<string, unknown> | undefined;
      if (cursor) {
        try {
          const key = memberCursorSchema.parse(
            JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
          );
          if (key.PK !== keys.group(groupId) || !key.SK.startsWith('MEMBER#')) throw new Error();
          start = key;
        } catch {
          throw new InvalidCursorError();
        }
      }
      const { Items = [], LastEvaluatedKey } = await db.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :member)',
          ExpressionAttributeValues: { ':pk': keys.group(groupId), ':member': 'MEMBER#' },
          ConsistentRead: true,
          Limit: limit,
          ExclusiveStartKey: start,
        }),
      );
      const members = Items.map((raw) => memberItemSchema.parse(raw));
      const userIds = members.map((m) => m.SK.slice('MEMBER#'.length));
      const names = await displayNames(userIds);
      return {
        items: members.map((m, i) => {
          const userId = userIds[i] ?? '';
          return {
            userId,
            displayName: names.get(userId) ?? null,
            role: m.role,
            joinedAt: m.joinedAt,
          };
        }),
        nextCursor: encodeCursor(LastEvaluatedKey),
      };
    },

    async createInvitation(input) {
      const ttl = ttlFor(input.expiresAt);
      try {
        await transact([
          adminCheck(input.groupId, input.createdBy),
          {
            ConditionCheck: {
              TableName: tableName,
              Key: { PK: keys.group(input.groupId), SK: 'META' },
              ConditionExpression: LIVE_GROUP,
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: keys.group(input.groupId),
                SK: keys.invite(input.invitationId),
                type: 'Invitation',
                invitationId: input.invitationId,
                tokenHash: input.tokenHash,
                createdBy: input.createdBy,
                createdAt: input.createdAt,
                expiresAt: input.expiresAt,
                maxUses: input.maxUses,
                uses: 0,
                ttl,
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: keys.token(input.tokenHash),
                SK: 'INVITE',
                type: 'InvitationToken',
                groupId: input.groupId,
                invitationId: input.invitationId,
                ttl,
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ]);
        return 'created';
      } catch (error) {
        // The creator lost admin rights, or the group was dissolved, while the request ran.
        if (cancellationCodes(error)?.slice(0, 2).includes('ConditionalCheckFailed')) {
          return 'not_allowed';
        }
        throw error;
      }
    },

    async listInvitations(groupId, now): Promise<StoredInvitation[]> {
      // Reads every page: used or expired rows awaiting TTL deletion must not hide active links.
      const items: Record<string, unknown>[] = [];
      let start: Record<string, unknown> | undefined;
      do {
        const page = await db.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :invite)',
            ExpressionAttributeValues: { ':pk': keys.group(groupId), ':invite': 'INVITE#' },
            ConsistentRead: true,
            ExclusiveStartKey: start,
          }),
        );
        items.push(...(page.Items ?? []));
        start = page.LastEvaluatedKey;
      } while (start);
      return items
        .map((raw) => invitationItemSchema.parse(raw))
        .filter((inv) => inv.expiresAt > now && inv.uses < inv.maxUses)
        .map((inv) => ({ ...inv, groupId }));
    },

    findInvitation,

    async revokeInvitation(groupId, invitationId, actorId) {
      const invite = z
        .object({ tokenHash: z.string() })
        .safeParse(await getItem(keys.group(groupId), keys.invite(invitationId)));
      if (!invite.success) return 'not_found';
      try {
        // The actor must still be an admin of a live group when the revocation commits.
        await transact([
          adminCheck(groupId, actorId),
          {
            ConditionCheck: {
              TableName: tableName,
              Key: { PK: keys.group(groupId), SK: 'META' },
              ConditionExpression: LIVE_GROUP,
            },
          },
          {
            Delete: {
              TableName: tableName,
              Key: { PK: keys.group(groupId), SK: keys.invite(invitationId) },
              ConditionExpression: 'attribute_exists(PK)',
            },
          },
          {
            Delete: {
              TableName: tableName,
              Key: { PK: keys.token(invite.data.tokenHash), SK: 'INVITE' },
            },
          },
        ]);
        return 'revoked';
      } catch (error) {
        const codes = cancellationCodes(error);
        if (!codes) throw error;
        if (codes[2] === 'ConditionalCheckFailed') return 'not_found';
        if (codes.includes('ConditionalCheckFailed')) return 'not_allowed';
        throw error;
      }
    },

    async acceptInvitation(tokenHash, userId, now, maxMembers): Promise<AcceptResult> {
      const invitation = await findInvitation(tokenHash, now);
      if (!invitation) return { status: 'invalid' };
      const { groupId, groupName, groupCreatedAt, invitationId } = invitation;
      try {
        await transact([
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: keys.group(groupId),
                SK: keys.member(userId),
                type: 'Membership',
                role: 'MEMBER',
                groupName,
                groupCreatedAt,
                joinedAt: now,
                invitationId,
                GSI1PK: keys.user(userId),
                GSI1SK: keys.group(groupId),
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            // One redemption per person per invitation, even after leaving or removal (replay).
            Put: {
              TableName: tableName,
              Item: {
                PK: keys.group(groupId),
                SK: keys.redemption(invitationId, userId),
                type: 'InvitationRedemption',
                redeemedAt: now,
                ttl: ttlFor(invitation.expiresAt),
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Update: {
              TableName: tableName,
              Key: { PK: keys.group(groupId), SK: keys.invite(invitationId) },
              UpdateExpression: 'SET uses = uses + :one',
              ConditionExpression: 'attribute_exists(PK) AND uses < maxUses AND expiresAt > :now',
              ExpressionAttributeValues: { ':one': 1, ':now': now },
            },
          },
          {
            Update: {
              TableName: tableName,
              Key: { PK: keys.group(groupId), SK: 'META' },
              // Groups created before the counter existed have exactly their creator.
              UpdateExpression: 'SET memberCount = if_not_exists(memberCount, :one) + :one',
              ConditionExpression: `${LIVE_GROUP} AND (attribute_not_exists(memberCount) OR memberCount < :max)`,
              ExpressionAttributeValues: { ':one': 1, ':max': maxMembers },
            },
          },
        ]);
        return { status: 'joined', groupId, groupName, groupCreatedAt };
      } catch (error) {
        const codes = cancellationCodes(error);
        if (!codes) throw error;
        const failed = (i: number) => codes[i] === 'ConditionalCheckFailed';
        // An existing member neither consumes nor is refused by the invitation. An unusable
        // invitation takes precedence over capacity, so invitees never learn a group is full
        // from a link that no longer works.
        if (failed(0)) return { status: 'already_member', groupId };
        if (failed(1) || failed(2)) return { status: 'invalid' };
        if (failed(3)) {
          const live = liveMetaSchema.safeParse(await getItem(keys.group(groupId), 'META'));
          return live.success ? { status: 'full' } : { status: 'invalid' };
        }
        throw error;
      }
    },

    async removeMember(groupId, userId, actorId): Promise<RemoveResult> {
      const target = await getMembership(groupId, userId);
      if (!target) return 'not_member';
      const self = userId === actorId;
      if (!self && target.role !== 'MEMBER') return 'not_allowed';
      const isAdmin = target.role === 'ADMIN';
      const items: TransactItems = [
        {
          Delete: {
            TableName: tableName,
            Key: { PK: keys.group(groupId), SK: keys.member(userId) },
            ConditionExpression: '#role = :role',
            ExpressionAttributeNames: { '#role': 'role' },
            ExpressionAttributeValues: { ':role': target.role },
          },
        },
        {
          Update: {
            TableName: tableName,
            Key: { PK: keys.group(groupId), SK: 'META' },
            // A missing adminCount (groups created before the counters) means one admin.
            UpdateExpression: isAdmin
              ? 'SET memberCount = if_not_exists(memberCount, :one) - :one, adminCount = adminCount - :one'
              : 'SET memberCount = if_not_exists(memberCount, :one) - :one',
            ConditionExpression: isAdmin ? `${LIVE_GROUP} AND adminCount > :one` : LIVE_GROUP,
            ExpressionAttributeValues: { ':one': 1 },
          },
        },
      ];
      if (!self) {
        // The actor must still be an admin when the removal commits.
        items.push({
          ConditionCheck: {
            TableName: tableName,
            Key: { PK: keys.group(groupId), SK: keys.member(actorId) },
            ConditionExpression: '#role = :admin',
            ExpressionAttributeNames: { '#role': 'role' },
            ExpressionAttributeValues: { ':admin': 'ADMIN' },
          },
        });
      }
      try {
        await transact(items);
        return 'removed';
      } catch (error) {
        const codes = cancellationCodes(error);
        if (!codes) throw error;
        if (codes[0] === 'ConditionalCheckFailed') return 'not_member';
        if (codes[1] === 'ConditionalCheckFailed') return isAdmin ? 'last_admin' : 'not_member';
        if (codes[2] === 'ConditionalCheckFailed') return 'not_allowed';
        throw error;
      }
    },

    async renameGroup(groupId, name, actorId) {
      try {
        await transact([
          adminCheck(groupId, actorId),
          {
            Update: {
              TableName: tableName,
              Key: { PK: keys.group(groupId), SK: 'META' },
              UpdateExpression: 'SET #name = :name',
              ConditionExpression: LIVE_GROUP,
              ExpressionAttributeNames: { '#name': 'name' },
              ExpressionAttributeValues: { ':name': name },
            },
          },
        ]);
        return 'renamed';
      } catch (error) {
        if (cancellationCodes(error)?.includes('ConditionalCheckFailed')) return 'not_allowed';
        throw error;
      }
    },

    async changeRole(groupId, userId, role, actorId) {
      const self = userId === actorId;
      // Self-targeted writes may only step down: a just-demoted admin must not re-promote.
      if (self && role === 'ADMIN') return 'not_allowed';
      const target = await getMembership(groupId, userId);
      if (!target) return 'not_member';
      if (target.role === role) return 'unchanged';
      const promote = role === 'ADMIN';
      const items: TransactItems = [
        {
          Update: {
            TableName: tableName,
            Key: { PK: keys.group(groupId), SK: keys.member(userId) },
            UpdateExpression: 'SET #role = :to',
            ConditionExpression: '#role = :from',
            ExpressionAttributeNames: { '#role': 'role' },
            ExpressionAttributeValues: { ':to': role, ':from': target.role },
          },
        },
        {
          Update: {
            TableName: tableName,
            Key: { PK: keys.group(groupId), SK: 'META' },
            // A missing adminCount (groups created before the counters) means one admin.
            UpdateExpression: promote
              ? 'SET adminCount = if_not_exists(adminCount, :one) + :one'
              : 'SET adminCount = adminCount - :one',
            ConditionExpression: promote ? LIVE_GROUP : `${LIVE_GROUP} AND adminCount > :one`,
            ExpressionAttributeValues: { ':one': 1 },
          },
        },
      ];
      // A self-demotion is its own authorization: the target condition requires the ADMIN role.
      if (!self) items.push(adminCheck(groupId, actorId));
      try {
        await transact(items);
        return 'changed';
      } catch (error) {
        const codes = cancellationCodes(error);
        if (!codes) throw error;
        const failed = (i: number) => codes[i] === 'ConditionalCheckFailed';
        if (failed(2)) return 'not_allowed';
        if (failed(0)) {
          // Deleted meanwhile, its role changed concurrently, or the group was dissolved.
          const live = liveMetaSchema.safeParse(await getItem(keys.group(groupId), 'META'));
          if (!live.success) return 'not_member';
          return (await getMembership(groupId, userId)) ? 'conflict' : 'not_member';
        }
        if (failed(1)) {
          const live = liveMetaSchema.safeParse(await getItem(keys.group(groupId), 'META'));
          if (!live.success) return 'not_member';
          return promote ? 'conflict' : 'last_admin';
        }
        throw error;
      }
    },

    async dissolveGroup(groupId, actorId) {
      const now = Math.floor(Date.now() / 1000);
      try {
        await transact([
          adminCheck(groupId, actorId),
          {
            Update: {
              TableName: tableName,
              Key: { PK: keys.group(groupId), SK: 'META' },
              UpdateExpression: 'SET dissolvedAt = :now, #ttl = :ttl',
              ConditionExpression: LIVE_GROUP,
              ExpressionAttributeNames: { '#ttl': 'ttl' },
              ExpressionAttributeValues: {
                ':now': new Date(now * 1000).toISOString(),
                ':ttl': now + DISSOLVED_MARKER_TTL_SECONDS,
              },
            },
          },
        ]);
      } catch (error) {
        if (cancellationCodes(error)?.includes('ConditionalCheckFailed')) return 'not_allowed';
        throw error;
      }
      // The group is gone for everyone from here on: every read and write requires a live META.
      // Remove what remains; anything a failed sweep leaves behind is inert, and the marker
      // itself expires via TTL.
      try {
        const items = await groupPartition(groupId);
        const pointers = items.flatMap((item) => {
          const hash = z.object({ tokenHash: z.string() }).safeParse(item);
          return hash.success ? [{ PK: keys.token(hash.data.tokenHash), SK: 'INVITE' }] : [];
        });
        await batchDelete(pointers);
        const rest = items.filter((item) => item.SK !== 'META');
        await batchDelete(rest.map((item) => ({ PK: item.PK, SK: item.SK })));
        await batchDelete([{ PK: keys.group(groupId), SK: 'META' }]);
      } catch (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            message: 'Dissolve cleanup incomplete',
            errorName: error instanceof Error ? error.name : 'UnknownError',
          }),
        );
      }
      return 'dissolved';
    },
  };
}
