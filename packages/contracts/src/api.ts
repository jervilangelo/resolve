/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';
import { domainTypeSchema, groupRoleSchema } from './domain';

/** Request/response DTOs for docs/MASTER_PLAN.md §11. All bodies are strict: unknown keys fail. */

export const groupIdSchema = z.string().regex(/^grp_[a-z0-9]{26}$/);

/**
 * Group and display names appear in alert emails sent from Resolve's address, so they may not
 * carry links, web addresses or email addresses (phishing; FR-19).
 */
const LINK_PATTERN = /:\/\/|www\.|@|[a-z0-9-]+\.[a-z]{2,}\b/iu;
/**
 * Whether a name looks like a link or address, including look-alike dots (。．｡). "word. Word"
 * (a space after the dot, as in "St. Mark's") stays allowed.
 */
export const LINK_LIKE = {
  test: (value: string) => LINK_PATTERN.test(value.normalize('NFKC').replace(/[。．｡]/gu, '.')),
};

const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[^\p{Cc}<>]+$/u, 'Must not contain control characters or angle brackets')
  .refine((value) => !LINK_LIKE.test(value), 'Must not contain links, web or email addresses');

export const profileSchema = z.strictObject({
  userId: z.string(),
  displayName: z.string().nullable(),
});
export type Profile = z.infer<typeof profileSchema>;

export const updateProfileRequestSchema = z.strictObject({ displayName: displayNameSchema });
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const createGroupRequestSchema = z.strictObject({ name: displayNameSchema });
export type CreateGroupRequest = z.infer<typeof createGroupRequestSchema>;

/** Admin-only group settings. */
export const updateGroupRequestSchema = z.strictObject({ name: displayNameSchema });
export type UpdateGroupRequest = z.infer<typeof updateGroupRequestSchema>;

/** Promote a member to admin or demote an admin; a group always keeps at least one admin. */
export const updateMemberRoleRequestSchema = z.strictObject({ role: groupRoleSchema });
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;

/** A group as seen by one of its members. Never includes domains (§4.3). */
export const groupSummarySchema = z.strictObject({
  groupId: groupIdSchema,
  name: z.string(),
  role: groupRoleSchema,
  createdAt: z.iso.datetime(),
});
export type GroupSummary = z.infer<typeof groupSummarySchema>;

/** Opaque, cursor-based pagination used by every list endpoint. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({ items: z.array(item), nextCursor: z.string().nullable() });
}
export const groupListSchema = pageSchema(groupSummarySchema);
export type GroupList = z.infer<typeof groupListSchema>;

export const pageQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(512).optional(),
});

/** Optional client-supplied key making POST requests safe to retry. */
export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

/** Opaque invitation token as it appears in links (32 random bytes, base64url). */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
/** Tokens travel only in request bodies, never in URLs (which proxies and hosts may log). */
export const invitationTokenRequestSchema = z.strictObject({ token: invitationTokenSchema });
export const invitationIdSchema = z.string().regex(/^inv_[a-z0-9]{26}$/);
export const userIdSchema = z.guid();

export const createInvitationRequestSchema = z.strictObject({
  /** How many people may join with this link. Single use by default. */
  maxUses: z.number().int().min(1).max(25).default(1),
});
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

/** Returned once, to the admin who created it; the token is never stored or shown again. */
export const createdInvitationSchema = z.strictObject({
  invitationId: invitationIdSchema,
  token: invitationTokenSchema,
  expiresAt: z.iso.datetime(),
  maxUses: z.number().int(),
});
export type CreatedInvitation = z.infer<typeof createdInvitationSchema>;

export const invitationSummarySchema = z.strictObject({
  invitationId: invitationIdSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  maxUses: z.number().int(),
  uses: z.number().int(),
});
export type InvitationSummary = z.infer<typeof invitationSummarySchema>;
export const invitationListSchema = pageSchema(invitationSummarySchema);

/** What an invitee sees before accepting. */
export const invitationPreviewSchema = z.strictObject({
  groupName: z.string(),
  expiresAt: z.iso.datetime(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const memberSchema = z.strictObject({
  userId: z.string(),
  displayName: z.string().nullable(),
  role: groupRoleSchema,
  joinedAt: z.iso.datetime(),
});
export type Member = z.infer<typeof memberSchema>;
export const memberListSchema = pageSchema(memberSchema);
export type MemberList = z.infer<typeof memberListSchema>;

/** Groups are capped to keep membership operations and notification fan-out bounded. */
export const MAX_GROUP_MEMBERS = 50;
export const INVITATION_TTL_DAYS = 7;

/** A group blocklist submission. Members may only add ADDITIONAL domains (the default). */
export const addDomainRequestSchema = z.strictObject({
  domain: z.string().min(1).max(300),
  type: domainTypeSchema.optional(),
});
export type AddDomainRequest = z.infer<typeof addDomainRequestSchema>;

/**
 * The only response members ever get for a valid submission: it never reveals whether the domain
 * was already listed, in which category, or by whom (§11).
 */
export const memberSubmissionResponseSchema = z.strictObject({
  message: z.literal('Submission received.'),
});
export const MEMBER_SUBMISSION_RESPONSE = { message: 'Submission received.' } as const;

/** A blocklist entry as shown to admins (who may see the full list). */
export const groupDomainSchema = z.strictObject({
  domain: z.string(),
  type: domainTypeSchema,
  addedBy: z.string(),
  createdAt: z.iso.datetime(),
});
export type GroupDomain = z.infer<typeof groupDomainSchema>;
export const groupDomainListSchema = pageSchema(groupDomainSchema);
export type GroupDomainList = z.infer<typeof groupDomainListSchema>;

/** Admin response to an addition, including essential services kept reachable beneath it. */
export const addedDomainSchema = groupDomainSchema.extend({ exempted: z.array(z.string()) });
export type AddedDomain = z.infer<typeof addedDomainSchema>;

export const updateDomainRequestSchema = z.strictObject({ type: domainTypeSchema });

/**
 * Enforcement snapshot for an active member's extension (§4.3). Rule secrecy holds at the
 * interface/API layer only: a browser that enforces rules can always be inspected.
 */
export const ruleSnapshotSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('current'),
    groupId: groupIdSchema,
    ruleVersion: z.number().int().min(0),
    essentialVersion: z.string(),
    essential: z.array(z.string()),
    nonNegotiable: z.array(z.string()),
    additional: z.array(z.string()),
  }),
  z.strictObject({
    status: z.literal('unchanged'),
    groupId: groupIdSchema,
    ruleVersion: z.number().int().min(0),
    essentialVersion: z.string(),
  }),
]);
export type RuleSnapshot = z.infer<typeof ruleSnapshotSchema>;

export const ruleQuerySchema = z.strictObject({
  groupId: groupIdSchema,
  version: z.coerce.number().int().min(0).optional(),
  essentialVersion: z.string().max(64).optional(),
});

/** Per-group cap: keeps compiled browser rules well inside declarativeNetRequest limits. */
export const MAX_GROUP_DOMAINS = 1000;
/** Blocklist submissions per user per hour, across groups. */
export const DOMAIN_SUBMISSIONS_PER_HOUR = 60;

export const domainAuditEntrySchema = z.strictObject({
  action: z.enum(['ADDED', 'REMOVED', 'RECLASSIFIED']),
  domain: z.string(),
  actorId: z.string(),
  at: z.iso.datetime(),
  from: domainTypeSchema.optional(),
  to: domainTypeSchema.optional(),
});
export const domainAuditListSchema = z.strictObject({ items: z.array(domainAuditEntrySchema) });
export type DomainAuditList = z.infer<typeof domainAuditListSchema>;
