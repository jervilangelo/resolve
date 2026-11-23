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
}

export class InvalidCursorError extends Error {
  constructor() {
    super('Invalid cursor');
    this.name = 'InvalidCursorError';
  }
}
