/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  type ConsentRecord,
  MAX_ALERTS_PER_RECIPIENT_PER_HOUR,
  NO_CONSENT,
  type OutboxItem,
  PRIVATE_SHARING,
  type SharingRecord,
  consentsTo,
  sharesWith,
} from '@resolve/contracts';
import { type EmailMessage, alertEmail } from './email';

/**
 * Delivery worker (docs/MASTER_PLAN.md §7.3). For one outbox item it handles each recipient at
 * most once, and only after re-checking, at send time, that the recipient is still a member, that
 * the sender's sharing still includes them and that they still consent. Consent withdrawn after
 * the event therefore still stops the email (§6.2).
 */
export type Outcome =
  | 'sent'
  | 'not_member'
  | 'not_shared'
  | 'no_consent'
  | 'rate_limited'
  | 'no_address'
  | 'rejected'
  | 'expired';

/** A send failure the worker must not retry (e.g. SES rejected the address). */
export class PermanentSendError extends Error {}

export interface DeliveryDeps {
  getOutbox(outboxId: string): Promise<OutboxItem | null>;
  /** The member's current membership in a live group, or null. */
  getMembership(groupId: string, userId: string): Promise<{ joinedAt: string } | null>;
  getSharing(groupId: string, userId: string): Promise<SharingRecord | null>;
  getConsent(groupId: string, userId: string): Promise<ConsentRecord | null>;
  /**
   * Claims the (outbox, recipient) pair; false if it was already handled or is in progress. A claim
   * left behind by a run that died (timeout, crash) can be taken over once it is stale.
   */
  claim(outboxId: string, recipientId: string): Promise<boolean>;
  /**
   * Marks the claim as sending, just before the email goes out. A claim in this state is never
   * taken over, so an email can never be sent twice (at worst, a crash right here loses one).
   */
  markSending(outboxId: string, recipientId: string): Promise<void>;
  /** Gives the claim back so a retry can try again (transient failure). */
  release(outboxId: string, recipientId: string): Promise<void>;
  finish(outboxId: string, recipientId: string, outcome: Outcome): Promise<void>;
  /** Counts one alert against the recipient's hourly cap; false when the cap is reached. */
  chargeRecipient(recipientId: string, bucket: string, max: number): Promise<boolean>;
  /** Gives back a charge whose send did not happen (transient failure), so retries cost nothing. */
  refundRecipient(recipientId: string, bucket: string): Promise<void>;
  /** Milliseconds left in this invocation; the worker stops early rather than time out mid-send. */
  remainingMs(): number;
  emailOf(userId: string): Promise<string | null>;
  /** Throws PermanentSendError for rejections; any other error is retried. */
  send(to: string, message: EmailMessage): Promise<void>;
  now(): Date;
  dashboardUrl: string;
}

/** Alerts older than this when (re)processed are dropped rather than sent late. */
export const MAX_DELIVERY_AGE_MS = 24 * 60 * 60 * 1000;
/** Time kept in reserve per recipient; below it the item is retried by a fresh invocation. */
export const PER_RECIPIENT_RESERVE_MS = 10_000;

/** Thrown to retry the rest of an item later (no claim is held for unprocessed recipients). */
export class OutOfTimeError extends Error {
  constructor() {
    super('Out of time; remaining recipients will be retried');
    this.name = 'OutOfTimeError';
  }
}

async function eligibility(
  item: OutboxItem,
  recipientId: string,
  deps: DeliveryDeps,
): Promise<Outcome | null> {
  const recipient = await deps.getMembership(item.groupId, recipientId);
  if (!recipient) return 'not_member';
  // No retroactive disclosure: someone who (re)joined after the event never hears of it.
  if (recipient.joinedAt > item.createdAt) return 'not_member';
  const epoch = { userId: recipientId, joinedAt: recipient.joinedAt };

  let sharing: SharingRecord;
  if (item.kind === 'GROUP_DEPARTURE') {
    // The sender has left: their choice as it stood before departure is the one that counts.
    sharing = { ...(item.departureSharing ?? PRIVATE_SHARING), updatedAt: null };
  } else {
    // The sender must still hold the same membership the event belongs to.
    const sender = await deps.getMembership(item.groupId, item.senderId);
    if (sender?.joinedAt !== item.senderJoinedAt) return 'not_shared';
    sharing = (await deps.getSharing(item.groupId, item.senderId)) ?? PRIVATE_SHARING;
  }
  if (!sharesWith(sharing, epoch)) return 'not_shared';

  const consent = (await deps.getConsent(item.groupId, recipientId)) ?? NO_CONSENT;
  const sender = { userId: item.senderId, joinedAt: item.senderJoinedAt };
  return consentsTo(consent, sender) ? null : 'no_consent';
}

export interface DeliveryResult {
  kind: OutboxItem['kind'] | null;
  outcomes: Partial<Record<Outcome, number>>;
}

/** Processes one outbox item; throws (after releasing its claim) when a retry should happen. */
export async function deliverOutbox(outboxId: string, deps: DeliveryDeps): Promise<DeliveryResult> {
  const outcomes: Partial<Record<Outcome, number>> = {};
  const item = await deps.getOutbox(outboxId);
  if (!item) return { kind: null, outcomes }; // expired or never existed: nothing to do
  const now = deps.now();
  const expired = now.getTime() - Date.parse(item.createdAt) > MAX_DELIVERY_AGE_MS;
  const message = alertEmail(item, deps.dashboardUrl);
  const bucket = `alerts#${now.toISOString().slice(0, 13)}`;

  for (const recipientId of item.recipientIds) {
    if (recipientId === item.senderId) continue;
    if (deps.remainingMs() < PER_RECIPIENT_RESERVE_MS) throw new OutOfTimeError();
    if (!(await deps.claim(outboxId, recipientId))) continue;
    let outcome: Outcome;
    let charged = false;
    try {
      outcome = expired ? 'expired' : ((await eligibility(item, recipientId, deps)) ?? 'sent');
      if (outcome === 'sent') {
        charged = await deps.chargeRecipient(
          recipientId,
          bucket,
          MAX_ALERTS_PER_RECIPIENT_PER_HOUR,
        );
        if (!charged) {
          outcome = 'rate_limited';
        } else {
          const address = await deps.emailOf(recipientId);
          if (!address) outcome = 'no_address';
          else {
            try {
              await deps.markSending(outboxId, recipientId);
              await deps.send(address, message);
            } catch (error) {
              if (!(error instanceof PermanentSendError)) throw error;
              outcome = 'rejected';
            }
          }
          // Only delivered alerts count against the cap.
          if (outcome !== 'sent') {
            await deps.refundRecipient(recipientId, bucket);
            charged = false;
          }
        }
      }
    } catch (error) {
      if (charged) await deps.refundRecipient(recipientId, bucket).catch(() => undefined);
      await deps.release(outboxId, recipientId);
      throw error;
    }
    // Best effort: the 'sending' mark already prevents a second send if recording fails.
    await deps.finish(outboxId, recipientId, outcome).catch(() => undefined);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return { kind: item.kind, outcomes };
}
