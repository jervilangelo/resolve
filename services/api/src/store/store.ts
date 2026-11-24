/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { GroupRole } from '@resolve/contracts';

export interface StoredProfile {
  displayName: string | null;
}

export interface StoredGroup {
  groupId: string;
  name: string;
  createdAt: string;
}

export interface StoredMembership {
  groupId: string;
  userId: string;
  role: GroupRole;
  groupName: string;
  groupCreatedAt: string;
}

export interface CreateGroupInput {
  groupId: string;
  name: string;
  ownerId: string;
  createdAt: string;
  idempotencyKey?: string;
}

export interface StoredMember {
  userId: string;
  displayName: string | null;
  role: GroupRole;
  joinedAt: string;
}

export interface StoredInvitation {
  invitationId: string;
  groupId: string;
  createdAt: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
}

export interface CreateInvitationInput extends StoredInvitation {
  tokenHash: string;
  createdBy: string;
}

export type AcceptResult =
  | { status: 'joined'; groupId: string; groupName: string; groupCreatedAt: string }
  | { status: 'already_member'; groupId: string }
  | { status: 'invalid' }
  | { status: 'full' };

export type RemoveResult = 'removed' | 'not_member' | 'last_admin' | 'not_allowed';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Persistence boundary. Routes depend on this interface, never on DynamoDB directly. */
export interface Store {
  getProfile(userId: string): Promise<StoredProfile | null>;
  putProfile(userId: string, profile: StoredProfile): Promise<void>;
  /** Atomically creates the group and its first admin. Replays return the original group ID. */
  createGroup(input: CreateGroupInput): Promise<{ groupId: string; created: boolean }>;
  getGroup(groupId: string): Promise<StoredGroup | null>;
  getMembership(groupId: string, userId: string): Promise<StoredMembership | null>;
  /** Throws InvalidCursorError for cursors that are malformed or belong to another user. */
  listMemberships(userId: string, limit: number, cursor?: string): Promise<Page<StoredMembership>>;

  /** Strongly consistent; includes each member's display name. */
  listMembers(groupId: string, limit: number, cursor?: string): Promise<Page<StoredMember>>;
  createInvitation(input: CreateInvitationInput): Promise<void>;
  listInvitations(groupId: string, now: string): Promise<StoredInvitation[]>;
  /** Looks up a usable (unexpired, not used up) invitation by token hash. */
  findInvitation(
    tokenHash: string,
    now: string,
  ): Promise<(StoredInvitation & { groupName: string }) | null>;
  revokeInvitation(groupId: string, invitationId: string): Promise<boolean>;
  /** Atomically adds the member, counts the use and enforces expiry, use and group limits. */
  acceptInvitation(
    tokenHash: string,
    userId: string,
    now: string,
    maxMembers: number,
  ): Promise<AcceptResult>;
  /**
   * Removes a membership. `self` = leaving; otherwise `actorId` must be an admin and the target a
   * member. The last admin can never be removed or leave.
   */
  removeMember(groupId: string, userId: string, actorId: string): Promise<RemoveResult>;
}

export class InvalidCursorError extends Error {
  constructor() {
    super('Invalid cursor');
    this.name = 'InvalidCursorError';
  }
}
