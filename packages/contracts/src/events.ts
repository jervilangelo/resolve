/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';
import { groupIdSchema } from './api';

/**
 * Trigger A (docs/MASTER_PLAN.md §7.1): the extension reports that a non-negotiable rule blocked a
 * top-level navigation. Deliberately minimal: no domain, URL, title or any other browsing detail.
 * The user comes from the access token, never the body; unknown fields are rejected.
 */
export const navigationEventRequestSchema = z.strictObject({
  /** Random per event, for idempotent retries. */
  eventId: z.string().regex(/^evt_[a-z2-7]{26}$/),
  groupId: groupIdSchema,
  eventType: z.literal('NON_NEGOTIABLE_NAVIGATION'),
  occurredAt: z.iso.datetime(),
  /** The rule version the extension enforced (validation and debugging only). */
  clientRuleVersion: z.number().int().min(0),
});
export type NavigationEventRequest = z.infer<typeof navigationEventRequestSchema>;

/** One response for every accepted request, whether or not anyone is notified. */
export const EVENT_RECEIVED_RESPONSE = { status: 'received' } as const;
export const eventReceivedSchema = z.strictObject({ status: z.literal('received') });

/** A member's alerts for one group are reported at most once per this many seconds. */
export const EVENT_COOLDOWN_SECONDS = 10 * 60;
/** Events older than this (or this far in the future) are ignored. */
export const EVENT_MAX_AGE_SECONDS = 60 * 60;
export const EVENT_MAX_SKEW_SECONDS = 5 * 60;
/** Alerts a single recipient can receive per hour, across all senders. */
export const MAX_ALERTS_PER_RECIPIENT_PER_HOUR = 10;
