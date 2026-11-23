/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { DynamoDBClient, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { groupRoleSchema } from '@resolve/contracts';
import { z } from 'zod';
import {
  type CreateGroupInput,
  InvalidCursorError,
  type Page,
  type Store,
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
 *   OUTBOX#<id>  OUTBOX                       notification outbox (relayed from the stream)
 */
export const keys = {
  user: (userId: string) => `USER#${userId}`,
  group: (groupId: string) => `GROUP#${groupId}`,
  member: (userId: string) => `MEMBER#${userId}`,
};

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

    async getMembership(groupId, userId) {
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
    },

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
  };
}
