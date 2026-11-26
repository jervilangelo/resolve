/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { outboxMessageSchema, parseEnv } from '@resolve/contracts';
import type { DynamoDBStreamEvent } from 'aws-lambda';
import { z } from 'zod';
import { relayOutbox } from '../relay';

const env = parseEnv('outbox-relay', z.object({ QUEUE_URL: z.url() }), process.env);
const sqs = new SQSClient({});

export const handler = (event: DynamoDBStreamEvent) =>
  relayOutbox(event, async (message) => {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: env.QUEUE_URL,
        MessageBody: JSON.stringify(outboxMessageSchema.parse(message)),
      }),
    );
  });
