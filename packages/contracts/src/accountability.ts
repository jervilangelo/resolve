/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';
import { MAX_GROUP_MEMBERS, userIdSchema } from './api';
import { type SharingMode, sharingModeSchema } from './domain';

/**
 * Voluntary accountability (docs/MASTER_PLAN.md §6). Each member decides who may receive their
 * alerts (sharing); each member separately decides whose alerts they agree to receive (consent).
 * Both are personal: nobody else, admins included, can read or change them for another member.
 */

/** Changes a member may make to their own sharing and consent per hour (abuse limit). */
export const ACCOUNTABILITY_CHANGES_PER_HOUR = 60;

export const updateSharingRequestSchema = z
  .strictObject({
    mode: sharingModeSchema,
    /** Only for SELECTED: the members chosen to receive alerts. */
    recipientIds: z.array(userIdSchema).max(MAX_GROUP_MEMBERS).default([]),
  })
  .refine(
    (v) => (v.mode === 'SELECTED' ? v.recipientIds.length > 0 : v.recipientIds.length === 0),
    {
      message: 'Choose at least one member for SELECTED; none for other modes',
      path: ['recipientIds'],
    },
  )
  .refine((v) => new Set(v.recipientIds).size === v.recipientIds.length, {
    message: 'Recipients must be unique',
    path: ['recipientIds'],
  });
export type UpdateSharingRequest = z.infer<typeof updateSharingRequestSchema>;

/** Whether to accept alerts from every member who chooses to share with you. */
export const updateReceivingRequestSchema = z.strictObject({ acceptAll: z.boolean() });
export type UpdateReceivingRequest = z.infer<typeof updateReceivingRequestSchema>;

const personSchema = z.strictObject({
  userId: z.string(),
  displayName: z.string().nullable(),
});

/** The caller's own view: never anyone else's relationships. */
export const accountabilityViewSchema = z.strictObject({
  sharing: z.strictObject({
    mode: sharingModeSchema,
    recipientIds: z.array(z.string()),
    updatedAt: z.iso.datetime().nullable(),
  }),
  receiving: z.strictObject({ acceptAll: z.boolean() }),
  /**
   * Who your alerts would reach: members in your sharing scope, each `receiving` (they agreed)
   * or `awaiting` (they have not agreed, so they get nothing).
   */
  recipients: z.array(personSchema.extend({ status: z.enum(['receiving', 'awaiting']) })),
  /**
   * Members who share with you: `receiving` once you agreed (individually or via acceptAll),
   * otherwise `needs_consent`.
   */
  senders: z.array(personSchema.extend({ status: z.enum(['receiving', 'needs_consent']) })),
});
export type AccountabilityView = z.infer<typeof accountabilityViewSchema>;

// ---- Policy rules shared by the API (resolution) and the delivery worker (re-check) ---------------

/** A member's own sharing choice; `recipients` maps each selected member to when they were chosen. */
export interface SharingRecord {
  mode: SharingMode;
  recipients: Record<string, string>;
  updatedAt: string | null;
}

/** A member's own consent; `senders` maps each accepted sender to when they were accepted. */
export interface ConsentRecord {
  acceptAll: boolean;
  senders: Record<string, string>;
}

/** A membership, identified by its member and when it began. */
export interface MembershipEpoch {
  userId: string;
  joinedAt: string;
}

export const PRIVATE_SHARING: SharingRecord = { mode: 'PRIVATE', recipients: {}, updatedAt: null };
export const NO_CONSENT: ConsentRecord = { acceptAll: false, senders: {} };

/**
 * Whether a sender's choice includes `recipient`. A selection only counts for the membership it was
 * made in: one made before the recipient (re)joined is ignored (no retroactive exposure).
 */
export function sharesWith(sharing: SharingRecord, recipient: MembershipEpoch): boolean {
  if (sharing.mode === 'EVERYONE') return true;
  if (sharing.mode !== 'SELECTED') return false;
  const selectedAt = sharing.recipients[recipient.userId];
  return selectedAt !== undefined && selectedAt >= recipient.joinedAt;
}

/** Whether a recipient agreed to `sender`'s alerts, for the sender's current membership. */
export function consentsTo(consent: ConsentRecord, sender: MembershipEpoch): boolean {
  if (consent.acceptAll) return true;
  const acceptedAt = consent.senders[sender.userId];
  return acceptedAt !== undefined && acceptedAt >= sender.joinedAt;
}
