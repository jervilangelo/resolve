/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { DynamoDBClient, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DeleteCommand,
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
    const meta = z.object({ name: z.string(), createdAt: z.string() }).safeParse(group);
    if (!inv.success || !meta.success) return null;
    if (inv.data.expiresAt <= now || inv.data.uses >= inv.data.maxUses) return null;
    return { ...inv.data, groupId, groupName: meta.data.name, groupCreatedAt: meta.data.createdAt };
  }

  /** Display names for up to 100 users (BatchGetItem limit), retrying unprocessed keys. */
  async function displayNames(userIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (userIds.length === 0) return names;
    let keysLeft: Record<string, unknown>[] = userIds.map((id) => ({
      PK: keys.user(id),
      SK: 'PROFILE',
    }));
    for (let attempt = 0; keysLeft.length > 0 && attempt < 5; attempt++) {
      const result = await db.send(
        new BatchGetCommand({ RequestItems: { [tableName]: { Keys: keysLeft } } }),
      );
      for (const item of result.Responses?.[tableName] ?? []) {
        const parsed = z.object({ PK: z.string(), displayName: z.string() }).safeParse(item);
        if (parsed.success)
          names.set(parsed.data.PK.slice('USER#'.length), parsed.data.displayName);
      }
      keysLeft = result.UnprocessedKeys?.[tableName]?.Keys ?? [];
    }
    return names;
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
      const { Item } = await db.send(
        new GetCommand({ TableName: tableName, Key: { PK: keys.group(groupId), SK: 'META' } }),
      );
      if (!Item) return null;
      const item = z.object({ name: z.string(), createdAt: z.string() }).parse(Item);
      return { groupId, name: item.name, createdAt: item.createdAt } satisfies StoredGroup;
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
      const items = Items.map((raw) => {
        const item = membershipItemSchema.parse(raw);
        return {
          groupId: item.PK.slice('GROUP#'.length),
          userId,
          role: item.role,
          groupName: item.groupName,
          groupCreatedAt: item.groupCreatedAt,
        };
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
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
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
          ],
        }),
      );
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

    async revokeInvitation(groupId, invitationId) {
      const { Attributes } = await db.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { PK: keys.group(groupId), SK: keys.invite(invitationId) },
          ReturnValues: 'ALL_OLD',
        }),
      );
      const old = z.object({ tokenHash: z.string() }).safeParse(Attributes);
      if (!old.success) return false;
      await db.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { PK: keys.token(old.data.tokenHash), SK: 'INVITE' },
        }),
      );
      return true;
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
              ConditionExpression:
                'attribute_exists(PK) AND (attribute_not_exists(memberCount) OR memberCount < :max)',
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
        if (failed(3)) return { status: 'full' };
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
            ConditionExpression: isAdmin ? 'adminCount > :one' : 'attribute_exists(PK)',
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
  };
}
