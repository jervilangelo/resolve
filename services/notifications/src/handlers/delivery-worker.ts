/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  OUTBOX_PK_PREFIX,
  OUTBOX_TTL_SECONDS,
  outboxItemSchema,
  outboxMessageSchema,
  parseEnv,
} from '@resolve/contracts';
import type { Context, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { z } from 'zod';
import { type DeliveryDeps, type Outcome, PermanentSendError, deliverOutbox } from '../delivery';

const env = parseEnv(
  'delivery-worker',
  z.object({
    TABLE_NAME: z.string().min(1),
    USER_POOL_ID: z.string().min(1),
    SENDER_EMAIL: z.email(),
    /** Display name shown in inboxes, e.g. "Resolve". */
    SENDER_NAME: z
      .string()
      .regex(/^[\w .-]{1,40}$/)
      .default('Resolve'),
    DASHBOARD_URL: z.url(),
  }),
  process.env,
);

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cognito = new CognitoIdentityProviderClient({});
const ses = new SESv2Client({});

/**
 * Only failures specific to one recipient are permanent. Sender-side problems (account paused,
 * identity unverified, throttling) are retried and end in the alarmed DLQ instead of being
 * silently recorded as rejected.
 */
const PERMANENT_SES_ERRORS = new Set(['MessageRejected']);

/** A claim older than this belongs to a run that died; another run may take it over. */
const STALE_CLAIM_SECONDS = 10 * 60;

const get = async (PK: string, SK: string) =>
  (
    await db.send(
      new GetCommand({ TableName: env.TABLE_NAME, Key: { PK, SK }, ConsistentRead: true }),
    )
  ).Item;

const deliveryKey = (outboxId: string, recipientId: string) => ({
  PK: `DELIVERY#${outboxId}`,
  SK: recipientId,
});

const deps: DeliveryDeps = {
  async getOutbox(outboxId) {
    const parsed = outboxItemSchema.safeParse(
      await get(`${OUTBOX_PK_PREFIX}${outboxId}`, 'OUTBOX'),
    );
    return parsed.success ? parsed.data : null;
  },
  async getMembership(groupId, userId) {
    const [meta, member] = await Promise.all([
      get(`GROUP#${groupId}`, 'META'),
      get(`GROUP#${groupId}`, `MEMBER#${userId}`),
    ]);
    if (!meta || 'dissolvedAt' in meta) return null;
    const parsed = z.object({ joinedAt: z.string() }).safeParse(member);
    return parsed.success ? parsed.data : null;
  },
  async getSharing(groupId, userId) {
    const parsed = z
      .object({
        mode: z.enum(['PRIVATE', 'SELECTED', 'EVERYONE']),
        recipients: z.record(z.string(), z.string()).default({}),
        updatedAt: z.string(),
      })
      .safeParse(await get(`GROUP#${groupId}`, `SHARE#${userId}`));
    return parsed.success ? parsed.data : null;
  },
  async getConsent(groupId, userId) {
    const item = await get(`GROUP#${groupId}`, `CONSENT#${userId}`);
    if (!item) return null;
    const senders: Record<string, string> = {};
    for (const [name, value] of Object.entries(item)) {
      if (name.startsWith('from_') && typeof value === 'string') senders[name.slice(5)] = value;
    }
    return { acceptAll: item.acceptAll === true, senders };
  },
  async claim(outboxId, recipientId) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    try {
      await db.send(
        new PutCommand({
          TableName: env.TABLE_NAME,
          Item: {
            ...deliveryKey(outboxId, recipientId),
            type: 'Delivery',
            status: 'claimed',
            claimedAt: nowSeconds,
            ttl: nowSeconds + OUTBOX_TTL_SECONDS,
          },
          ConditionExpression:
            'attribute_not_exists(PK) OR (#status = :claimed AND claimedAt < :stale)',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':claimed': 'claimed',
            ':stale': nowSeconds - STALE_CLAIM_SECONDS,
          },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  },
  async markSending(outboxId, recipientId) {
    await db.send(
      new UpdateCommand({
        TableName: env.TABLE_NAME,
        Key: deliveryKey(outboxId, recipientId),
        UpdateExpression: 'SET #status = :sending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':sending': 'sending' },
      }),
    );
  },
  async release(outboxId, recipientId) {
    await db.send(
      new DeleteCommand({ TableName: env.TABLE_NAME, Key: deliveryKey(outboxId, recipientId) }),
    );
  },
  async finish(outboxId, recipientId, outcome: Outcome) {
    await db.send(
      new UpdateCommand({
        TableName: env.TABLE_NAME,
        Key: deliveryKey(outboxId, recipientId),
        UpdateExpression: 'SET #status = :status, finishedAt = :at',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': outcome, ':at': new Date().toISOString() },
      }),
    );
  },
  async chargeRecipient(recipientId, bucket, max) {
    try {
      await db.send(
        new UpdateCommand({
          TableName: env.TABLE_NAME,
          Key: { PK: `USER#${recipientId}`, SK: `RATE#${bucket}` },
          UpdateExpression:
            'SET submissions = if_not_exists(submissions, :zero) + :one, #ttl = :ttl',
          ConditionExpression: 'attribute_not_exists(submissions) OR submissions < :limit',
          ExpressionAttributeNames: { '#ttl': 'ttl' },
          ExpressionAttributeValues: {
            ':zero': 0,
            ':one': 1,
            ':limit': max,
            ':ttl': Math.floor(Date.now() / 1000) + 2 * 60 * 60,
          },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  },
  async refundRecipient(recipientId, bucket) {
    await db
      .send(
        new UpdateCommand({
          TableName: env.TABLE_NAME,
          Key: { PK: `USER#${recipientId}`, SK: `RATE#${bucket}` },
          UpdateExpression: 'SET submissions = submissions - :one',
          ConditionExpression: 'submissions > :zero',
          ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
        }),
      )
      .catch((error: unknown) => {
        if (!(error instanceof ConditionalCheckFailedException)) throw error;
      });
  },
  remainingMs: () => Number.POSITIVE_INFINITY,
  async emailOf(userId) {
    // Email addresses live only in Cognito; they are looked up at send time and never stored.
    const { Users = [] } = await cognito.send(
      new ListUsersCommand({
        UserPoolId: env.USER_POOL_ID,
        Filter: `sub = "${userId.replaceAll('"', '')}"`,
        Limit: 1,
      }),
    );
    const attributes = Users[0]?.Attributes ?? [];
    const value = (name: string) => attributes.find((a) => a.Name === name)?.Value;
    return Users[0]?.Enabled !== false && value('email_verified') === 'true'
      ? (value('email') ?? null)
      : null;
  },
  async send(to, message) {
    try {
      await ses.send(
        new SendEmailCommand({
          FromEmailAddress: `"${env.SENDER_NAME}" <${env.SENDER_EMAIL}>`,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: message.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: message.text, Charset: 'UTF-8' },
                Html: { Data: message.html, Charset: 'UTF-8' },
              },
            },
          },
        }),
      );
    } catch (error) {
      if (error instanceof Error && PERMANENT_SES_ERRORS.has(error.name)) {
        throw new PermanentSendError(error.name);
      }
      throw error;
    }
  },
  now: () => new Date(),
  dashboardUrl: env.DASHBOARD_URL,
};

/** Delivery counts as CloudWatch metrics (embedded metric format); no names, IDs or addresses. */
function logOutcomes(kind: string, outcomes: Partial<Record<Outcome, number>>) {
  const names = Object.keys(outcomes);
  if (names.length === 0) return;
  // eslint-disable-next-line no-console -- CloudWatch reads embedded metrics from stdout.
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: 'Resolve/Notifications',
            Dimensions: [['Kind']],
            Metrics: names.map((Name) => ({ Name, Unit: 'Count' })),
          },
        ],
      },
      Kind: kind,
      ...outcomes,
    }),
  );
}

export async function handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  const batchItemFailures: { itemIdentifier: string }[] = [];
  const run = { ...deps, remainingMs: () => context.getRemainingTimeInMillis() };
  for (const record of event.Records) {
    try {
      const { outboxId } = outboxMessageSchema.parse(JSON.parse(record.body));
      const { kind, outcomes } = await deliverOutbox(outboxId, run);
      logOutcomes(kind ?? 'UNKNOWN', outcomes);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Delivery failed; will retry',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
