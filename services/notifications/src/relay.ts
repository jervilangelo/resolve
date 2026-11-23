/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { OUTBOX_PK_PREFIX, type OutboxMessage } from '@resolve/contracts';
import type { DynamoDBBatchResponse, DynamoDBStreamEvent } from 'aws-lambda';

export type SendMessage = (message: OutboxMessage) => Promise<void>;

/**
 * Forwards newly inserted outbox items to the delivery queue. Records are processed in order;
 * on the first failure the remaining batch is reported back so the stream retries from there,
 * preserving at-least-once delivery (the worker deduplicates by outbox ID).
 */
export async function relayOutbox(
  event: DynamoDBStreamEvent,
  send: SendMessage,
): Promise<DynamoDBBatchResponse> {
  for (const record of event.Records) {
    const pk = record.dynamodb?.Keys?.PK?.S;
    // The event source mapping already filters to INSERTs of outbox keys; re-check defensively.
    if (record.eventName !== 'INSERT' || !pk?.startsWith(OUTBOX_PK_PREFIX)) continue;
    try {
      await send({ outboxId: pk.slice(OUTBOX_PK_PREFIX.length) });
    } catch {
      const sequence = record.dynamodb?.SequenceNumber;
      return { batchItemFailures: sequence ? [{ itemIdentifier: sequence }] : [] };
    }
  }
  return { batchItemFailures: [] };
}
