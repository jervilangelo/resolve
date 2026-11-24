/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  type CreateInvitationInput,
  InvalidCursorError,
  type Store,
  type StoredGroup,
  type StoredMembership,
  type StoredProfile,
} from './store';

interface MemoryMembership extends StoredMembership {
  joinedAt: string;
}

/** In-memory Store with the same semantics as the DynamoDB store, for route unit tests. */
export function createMemoryStore(): Store {
  const profiles = new Map<string, StoredProfile>();
  const groups = new Map<string, StoredGroup & { memberCount: number; adminCount: number }>();
  const memberships = new Map<string, MemoryMembership>();
  const idempotency = new Map<string, string>();
  const invitations = new Map<string, CreateInvitationInput>();
  const redemptions = new Set<string>();

  const memberKey = (groupId: string, userId: string) => `${groupId}#${userId}`;

  function page<T>(all: T[], owner: string, limit: number, cursor?: string) {
    let start = 0;
    if (cursor) {
      const [who, index] = Buffer.from(cursor, 'base64url').toString('utf8').split(':');
      start = Number(index);
      if (who !== owner || !Number.isInteger(start) || start < 0) throw new InvalidCursorError();
    }
    const next = start + limit < all.length ? start + limit : null;
    return {
      items: all.slice(start, start + limit),
      nextCursor:
        next === null ? null : Buffer.from(`${owner}:${String(next)}`).toString('base64url'),
    };
  }

  function usable(tokenHash: string, now: string) {
    const inv = [...invitations.values()].find((i) => i.tokenHash === tokenHash);
    return inv && inv.expiresAt > now && inv.uses < inv.maxUses ? inv : undefined;
  }

  const store: Store = {
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
        memberCount: 1,
        adminCount: 1,
      });
      memberships.set(memberKey(input.groupId, input.ownerId), {
        groupId: input.groupId,
        userId: input.ownerId,
        role: 'ADMIN',
        groupName: input.name,
        groupCreatedAt: input.createdAt,
        joinedAt: input.createdAt,
      });
      if (idemKey) idempotency.set(idemKey, input.groupId);
      return Promise.resolve({ groupId: input.groupId, created: true });
    },
    getGroup: (groupId) => {
      const group = groups.get(groupId);
      return Promise.resolve(
        group ? { groupId: group.groupId, name: group.name, createdAt: group.createdAt } : null,
      );
    },
    getMembership: (groupId, userId) => {
      const m = memberships.get(memberKey(groupId, userId));
      return Promise.resolve(
        m
          ? {
              groupId: m.groupId,
              userId: m.userId,
              role: m.role,
              groupName: m.groupName,
              groupCreatedAt: m.groupCreatedAt,
            }
          : null,
      );
    },
    listMemberships: (userId, limit, cursor) => {
      try {
        const all = [...memberships.values()]
          .filter((m) => m.userId === userId)
          .sort((a, b) => a.groupId.localeCompare(b.groupId))
          .map(({ joinedAt: _joinedAt, ...rest }) => rest);
        return Promise.resolve(page(all, userId, limit, cursor));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
    listMembers: (groupId, limit, cursor) => {
      try {
        const all = [...memberships.values()]
          .filter((m) => m.groupId === groupId)
          .sort((a, b) => a.userId.localeCompare(b.userId))
          .map((m) => ({
            userId: m.userId,
            displayName: profiles.get(m.userId)?.displayName ?? null,
            role: m.role,
            joinedAt: m.joinedAt,
          }));
        return Promise.resolve(page(all, groupId, limit, cursor));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
    createInvitation: (input) => {
      invitations.set(input.invitationId, { ...input, uses: 0 });
      return Promise.resolve();
    },
    listInvitations: (groupId, now) =>
      Promise.resolve(
        [...invitations.values()]
          .filter((i) => i.groupId === groupId && i.expiresAt > now && i.uses < i.maxUses)
          .map(({ tokenHash: _t, createdBy: _c, ...rest }) => rest),
      ),
    findInvitation: (tokenHash, now) => {
      const inv = usable(tokenHash, now);
      const group = inv && groups.get(inv.groupId);
      if (!inv || !group) return Promise.resolve(null);
      const { tokenHash: _t, createdBy: _c, ...rest } = inv;
      return Promise.resolve({ ...rest, groupName: group.name });
    },
    revokeInvitation: (groupId, invitationId) => {
      const inv = invitations.get(invitationId);
      if (inv?.groupId !== groupId) return Promise.resolve(false);
      invitations.delete(invitationId);
      return Promise.resolve(true);
    },
    acceptInvitation: (tokenHash, userId, now, maxMembers) => {
      const inv = usable(tokenHash, now);
      const group = inv && groups.get(inv.groupId);
      if (!inv || !group) return Promise.resolve({ status: 'invalid' as const });
      if (memberships.has(memberKey(inv.groupId, userId))) {
        return Promise.resolve({ status: 'already_member' as const, groupId: inv.groupId });
      }
      const redemption = `${inv.invitationId}#${userId}`;
      if (redemptions.has(redemption)) return Promise.resolve({ status: 'invalid' as const });
      if (group.memberCount >= maxMembers) return Promise.resolve({ status: 'full' as const });
      redemptions.add(redemption);
      inv.uses += 1;
      group.memberCount += 1;
      memberships.set(memberKey(inv.groupId, userId), {
        groupId: inv.groupId,
        userId,
        role: 'MEMBER',
        groupName: group.name,
        groupCreatedAt: group.createdAt,
        joinedAt: now,
      });
      return Promise.resolve({
        status: 'joined' as const,
        groupId: inv.groupId,
        groupName: group.name,
        groupCreatedAt: group.createdAt,
      });
    },
    removeMember: (groupId, userId, actorId) => {
      const target = memberships.get(memberKey(groupId, userId));
      const group = groups.get(groupId);
      if (!target || !group) return Promise.resolve('not_member' as const);
      const self = userId === actorId;
      if (!self) {
        const actor = memberships.get(memberKey(groupId, actorId));
        if (target.role !== 'MEMBER' || actor?.role !== 'ADMIN') {
          return Promise.resolve('not_allowed' as const);
        }
      }
      if (target.role === 'ADMIN') {
        if (group.adminCount <= 1) return Promise.resolve('last_admin' as const);
        group.adminCount -= 1;
      }
      group.memberCount -= 1;
      memberships.delete(memberKey(groupId, userId));
      return Promise.resolve('removed' as const);
    },
  };
  return store;
}
