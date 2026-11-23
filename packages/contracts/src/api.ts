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
