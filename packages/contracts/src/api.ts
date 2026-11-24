/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';
import { groupRoleSchema } from './domain';

/** Request/response DTOs for docs/MASTER_PLAN.md §11. All bodies are strict: unknown keys fail. */

export const groupIdSchema = z.string().regex(/^grp_[a-z0-9]{26}$/);

const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[^\p{Cc}<>]+$/u, 'Must not contain control characters or angle brackets');

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
