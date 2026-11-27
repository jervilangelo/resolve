/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
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

/**
 * The two v1 triggers (§7) and the opt-in installation alerts (§7.4): Resolve removed from one of
 * the sender's browsers, and an enrolled browser no longer checking in.
 */
export const outboxKindSchema = z.enum([
  'NON_NEGOTIABLE_NAVIGATION',
  'GROUP_DEPARTURE',
  'EXTENSION_REMOVED',
  'EXTENSION_INACTIVE',
]);
export type OutboxKind = z.infer<typeof outboxKindSchema>;

/**
 * The outbox item (PK `OUTBOX#<outboxId>`, SK `OUTBOX`). It names recipients resolved when the
 * event happened; the worker re-checks each against current membership, the sender's sharing and
 * the recipient's consent before sending. It never holds a domain, URL or any browsing detail.
 */
export const outboxItemSchema = z.object({
  outboxId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  kind: outboxKindSchema,
  groupId: z.string(),
  groupName: z.string(),
  senderId: z.string(),
  senderName: z.string().nullable(),
  /** The sender's membership the event belongs to (consent is bound to it). */
  senderJoinedAt: z.string(),
  /**
   * GROUP_DEPARTURE only: the sender's sharing at departure (the sender has no membership left to
   * read it from). NON_NEGOTIABLE_NAVIGATION re-reads the sender's current sharing instead.
   */
  departureSharing: z
    .object({
      mode: z.enum(['PRIVATE', 'SELECTED', 'EVERYONE']),
      recipients: z.record(z.string(), z.string()),
    })
    .optional(),
  recipientIds: z.array(z.string()).min(1).max(100),
  /**
   * Installation alerts only: when it happened (EXTENSION_REMOVED) or the last check-in
   * (EXTENSION_INACTIVE). Shown to recipients; no other detail of the installation is kept here.
   */
  occurredAt: z.string().optional(),
  createdAt: z.string(),
});
export type OutboxItem = z.infer<typeof outboxItemSchema>;

/** Outbox items and delivery records expire after this many seconds. */
export const OUTBOX_TTL_SECONDS = 30 * 24 * 60 * 60;

export const outboxMessageSchema = z.strictObject({
  outboxId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
});
export type OutboxMessage = z.infer<typeof outboxMessageSchema>;
