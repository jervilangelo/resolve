/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';

/**
 * Shared vocabulary from docs/MASTER_PLAN.md (§3, §4.1, §6.1). Only the enumerations are
 * defined here; request/response DTOs are added together with the features that use them.
 */

/** Group roles. Authorization is always enforced server-side. */
export const groupRoleSchema = z.enum(['ADMIN', 'MEMBER']);
export type GroupRole = z.infer<typeof groupRoleSchema>;

/** Per-member accountability sharing mode. The default is always PRIVATE. */
export const sharingModeSchema = z.enum(['PRIVATE', 'SELECTED', 'EVERYONE']);
export type SharingMode = z.infer<typeof sharingModeSchema>;
export const DEFAULT_SHARING_MODE: SharingMode = 'PRIVATE';

/** Group-managed domain categories. Essential exemptions are platform-owned, not group-owned. */
export const domainTypeSchema = z.enum(['NON_NEGOTIABLE', 'ADDITIONAL']);
export type DomainType = z.infer<typeof domainTypeSchema>;
