/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { OutboxMessage } from '@resolve/contracts';
import type { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { relayOutbox } from './relay';

function record(pk: string, sequence: string, eventName: DynamoDBRecord['eventName'] = 'INSERT') {
  return {
    eventName,
    dynamodb: {
      Keys: { PK: { S: pk }, SK: { S: 'OUTBOX' } },
      SequenceNumber: sequence,
      NewImage: { PK: { S: pk }, recipientEmail: { S: 'secret@example.com' } },
    },
  } as DynamoDBRecord;
}

const batch = (...records: DynamoDBRecord[]): DynamoDBStreamEvent => ({ Records: records });

describe('relayOutbox', () => {
  it('forwards only the outbox ID of inserted outbox items', async () => {
    const sent: OutboxMessage[] = [];
    const result = await relayOutbox(
      batch(record('OUTBOX#a1', '1'), record('GROUP#g', '2'), record('OUTBOX#b2', '3', 'MODIFY')),
      (message) => {
        sent.push(message);
        return Promise.resolve();
      },
    );
    expect(sent).toEqual([{ outboxId: 'a1' }]);
    expect(JSON.stringify(sent)).not.toContain('secret@example.com');
    expect(result.batchItemFailures).toEqual([]);
  });

  it('stops at the first failure so the stream retries from that record', async () => {
    const sent: string[] = [];
    const result = await relayOutbox(
      batch(record('OUTBOX#a', '1'), record('OUTBOX#b', '2'), record('OUTBOX#c', '3')),
      (message) => {
        if (message.outboxId === 'b') return Promise.reject(new Error('throttled'));
        sent.push(message.outboxId);
        return Promise.resolve();
      },
    );
    expect(sent).toEqual(['a']);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: '2' }]);
  });
});
