/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  InvalidCursorError,
  type Store,
  type StoredGroup,
  type StoredMembership,
  type StoredProfile,
} from './store';

/** In-memory Store with the same semantics as the DynamoDB store, for route unit tests. */
export function createMemoryStore(): Store {
  const profiles = new Map<string, StoredProfile>();
  const groups = new Map<string, StoredGroup>();
  const memberships = new Map<string, StoredMembership>();
  const idempotency = new Map<string, string>();

  return {
    getProfile: (userId) => Promise.resolve(profiles.get(userId) ?? null),
    putProfile: (userId, profile) => {
      profiles.set(userId, profile);
      return Promise.resolve();
    },
    createGroup: (input) => {
      const idemKey = input.idempotencyKey && `${input.ownerId}#${input.idempotencyKey}`;
      const existing = idemKey ? idempotency.get(idemKey) : undefined;
      if (existing) return Promise.resolve({ groupId: existing, created: false });
      groups.set(input.groupId, {
        groupId: input.groupId,
        name: input.name,
        createdAt: input.createdAt,
      });
      memberships.set(`${input.groupId}#${input.ownerId}`, {
        groupId: input.groupId,
        userId: input.ownerId,
        role: 'ADMIN',
        groupName: input.name,
        groupCreatedAt: input.createdAt,
      });
      if (idemKey) idempotency.set(idemKey, input.groupId);
      return Promise.resolve({ groupId: input.groupId, created: true });
    },
    getGroup: (groupId) => Promise.resolve(groups.get(groupId) ?? null),
    getMembership: (groupId, userId) =>
      Promise.resolve(memberships.get(`${groupId}#${userId}`) ?? null),
    listMemberships: (userId, limit, cursor) => {
      const all = [...memberships.values()]
        .filter((m) => m.userId === userId)
        .sort((a, b) => a.groupId.localeCompare(b.groupId));
      let start = 0;
      if (cursor) {
        const [owner, index] = Buffer.from(cursor, 'base64url').toString('utf8').split(':');
        start = Number(index);
        if (owner !== userId || !Number.isInteger(start) || start < 0) {
          return Promise.reject(new InvalidCursorError());
        }
      }
      const items = all.slice(start, start + limit);
      const next = start + limit < all.length ? start + limit : null;
      return Promise.resolve({
        items,
        nextCursor:
          next === null ? null : Buffer.from(`${userId}:${String(next)}`).toString('base64url'),
      });
    },
  };
}
