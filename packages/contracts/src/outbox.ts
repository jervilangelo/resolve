/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';

/**
 * Notification outbox (docs/MASTER_PLAN.md §7.3). Producers write an outbox item in the same
 * DynamoDB transaction as the triggering change; the relay forwards only its ID to SQS, and the
 * delivery worker re-reads the item and re-checks consent before sending anything.
 */
export const OUTBOX_PK_PREFIX = 'OUTBOX#';

/** The two and only two v1 triggers (§7). */
export const outboxKindSchema = z.enum(['NON_NEGOTIABLE_NAVIGATION', 'GROUP_DEPARTURE']);
export type OutboxKind = z.infer<typeof outboxKindSchema>;

export const outboxMessageSchema = z.strictObject({
  outboxId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
});
export type OutboxMessage = z.infer<typeof outboxMessageSchema>;
