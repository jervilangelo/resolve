/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  type CreateInvitationInput,
  InvalidCursorError,
  type Store,
  type StoredGroup,
  type StoredMembership,
  type DomainAuditEntry,
  type StoredDomain,
  type StoredProfile,
  type StoredConsent,
  type StoredSharing,
} from './store';
import type { OutboxItem } from '@resolve/contracts';

interface MemoryMembership extends StoredMembership {
  joinedAt: string;
}

/** In-memory Store with the same semantics as the DynamoDB store, for route unit tests. */
export function createMemoryStore(): Store & { outboxItems(): OutboxItem[] } {
  const profiles = new Map<string, StoredProfile>();
  const groups = new Map<string, StoredGroup & { memberCount: number; adminCount: number }>();
  const memberships = new Map<string, MemoryMembership>();
  const idempotency = new Map<string, string>();
  const invitations = new Map<string, CreateInvitationInput>();
  const redemptions = new Set<string>();
  const domains = new Map<string, StoredDomain & { groupId: string }>();
  const ruleVersions = new Map<string, number>();
  const rateCounters = new Map<string, number>();
  const audit: (DomainAuditEntry & { groupId: string })[] = [];
  /** Keyed by memberKey(groupId, userId). */
  const sharing = new Map<string, StoredSharing>();
  const consents = new Map<string, StoredConsent>();
  /** Outbox items by ID, plus event IDs seen and cooldowns (memberKey -> until, epoch ms). */
  const outbox = new Map<string, OutboxItem>();
  const seenEvents = new Set<string>();
  const cooldowns = new Map<string, number>();
  const deletedUsers = new Set<string>();
  const liveMember = (groupId: string, userId: string) =>
    groups.has(groupId) && memberships.has(memberKey(groupId, userId));
  const inGroup = <T>(map: Map<string, T>, groupId: string) =>
    new Map(
      [...map]
        .filter(([key]) => key.startsWith(`${groupId}#`))
        .map(([key, value]) => [key.slice(groupId.length + 1), value]),
    );
  const bump = (groupId: string) => ruleVersions.set(groupId, (ruleVersions.get(groupId) ?? 0) + 1);

  const memberKey = (groupId: string, userId: string) => `${groupId}#${userId}`;
  const isAdmin = (groupId: string, userId: string) =>
    memberships.get(memberKey(groupId, userId))?.role === 'ADMIN';

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

  const store: Store & { outboxItems(): OutboxItem[] } = {
    /** Test helper: outbox items written so far. */
    outboxItems: () => [...outbox.values()],
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
          .filter((m) => m.userId === userId && groups.has(m.groupId))
          .sort((a, b) => a.groupId.localeCompare(b.groupId))
          .map(({ joinedAt: _joinedAt, ...rest }) => ({
            ...rest,
            groupName: groups.get(rest.groupId)?.name ?? rest.groupName,
          }));
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
      if (!groups.has(input.groupId) || !isAdmin(input.groupId, input.createdBy)) {
        return Promise.resolve('not_allowed' as const);
      }
      invitations.set(input.invitationId, { ...input, uses: 0 });
      return Promise.resolve('created' as const);
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
    revokeInvitation: (groupId, invitationId, actorId) => {
      const inv = invitations.get(invitationId);
      if (inv?.groupId !== groupId) return Promise.resolve('not_found' as const);
      if (!groups.has(groupId) || !isAdmin(groupId, actorId)) {
        return Promise.resolve('not_allowed' as const);
      }
      invitations.delete(invitationId);
      return Promise.resolve('revoked' as const);
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
    removeMember: (groupId, userId, actorId, departure) => {
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
      sharing.delete(memberKey(groupId, userId));
      consents.delete(memberKey(groupId, userId));
      if (departure) outbox.set(departure.outbox.outboxId, departure.outbox);
      return Promise.resolve('removed' as const);
    },
    renameGroup: (groupId, name, actorId) => {
      const group = groups.get(groupId);
      if (!group || !isAdmin(groupId, actorId)) return Promise.resolve('not_allowed' as const);
      group.name = name;
      return Promise.resolve('renamed' as const);
    },
    changeRole: (groupId, userId, role, actorId) => {
      if (userId === actorId && role === 'ADMIN') return Promise.resolve('not_allowed' as const);
      const target = memberships.get(memberKey(groupId, userId));
      const group = groups.get(groupId);
      if (!target || !group) return Promise.resolve('not_member' as const);
      if (target.role === role) return Promise.resolve('unchanged' as const);
      if (userId !== actorId && !isAdmin(groupId, actorId)) {
        return Promise.resolve('not_allowed' as const);
      }
      if (role === 'MEMBER') {
        if (group.adminCount <= 1) return Promise.resolve('last_admin' as const);
        group.adminCount -= 1;
      } else {
        group.adminCount += 1;
      }
      target.role = role;
      return Promise.resolve('changed' as const);
    },
    dissolveGroup: (groupId, actorId, options) => {
      const group = groups.get(groupId);
      if (!group || !isAdmin(groupId, actorId)) return Promise.resolve('not_allowed' as const);
      if (options?.onlyIfSolo && group.memberCount !== 1) {
        return Promise.resolve('not_allowed' as const);
      }
      groups.delete(groupId);
      for (const [key, m] of memberships) if (m.groupId === groupId) memberships.delete(key);
      for (const [id, inv] of invitations) if (inv.groupId === groupId) invitations.delete(id);
      for (const [key, d] of domains) if (d.groupId === groupId) domains.delete(key);
      for (const map of [sharing, consents]) {
        for (const key of map.keys()) if (key.startsWith(`${groupId}#`)) map.delete(key);
      }
      return Promise.resolve('dissolved' as const);
    },
    addDomain: (input) => {
      const member = memberships.get(memberKey(input.groupId, input.addedBy));
      const allowed =
        groups.has(input.groupId) &&
        member !== undefined &&
        (input.type === 'ADDITIONAL' || member.role === 'ADMIN');
      if (!allowed) return Promise.resolve('not_allowed' as const);
      const key = `${input.groupId}#${input.domain}`;
      if (domains.has(key)) return Promise.resolve('exists' as const);
      const count = [...domains.values()].filter((d) => d.groupId === input.groupId).length;
      if (count >= input.maxDomains) return Promise.resolve('full' as const);
      audit.push({
        groupId: input.groupId,
        action: 'ADDED',
        domain: input.domain,
        actorId: input.addedBy,
        at: input.createdAt,
        to: input.type,
      });
      domains.set(key, {
        groupId: input.groupId,
        domain: input.domain,
        type: input.type,
        addedBy: input.addedBy,
        createdAt: input.createdAt,
      });
      bump(input.groupId);
      return Promise.resolve('added' as const);
    },
    listDomains: (groupId) =>
      Promise.resolve(
        [...domains.values()]
          .filter((d) => d.groupId === groupId)
          .sort((a, b) => a.domain.localeCompare(b.domain))
          .map(({ groupId: _g, ...rest }) => rest),
      ),
    chargeSubmission: (userId, bucket, maxPerHour) => {
      const key = `${userId}#${bucket}`;
      const used = rateCounters.get(key) ?? 0;
      if (used >= maxPerHour) return Promise.resolve(false);
      rateCounters.set(key, used + 1);
      return Promise.resolve(true);
    },
    listDomainAudit: (groupId, limit) =>
      Promise.resolve(
        audit
          .filter((e) => e.groupId === groupId)
          .reverse()
          .slice(0, limit)
          .map(({ groupId: _g, ...rest }) => rest),
      ),
    removeDomain: (groupId, domain, actorId, at) => {
      if (!groups.has(groupId) || !isAdmin(groupId, actorId)) {
        return Promise.resolve('not_allowed' as const);
      }
      if (!domains.delete(`${groupId}#${domain}`)) return Promise.resolve('not_found' as const);
      audit.push({ groupId, action: 'REMOVED', domain, actorId, at });
      bump(groupId);
      return Promise.resolve('removed' as const);
    },
    changeDomainType: (groupId, domain, type, actorId, at) => {
      if (!groups.has(groupId) || !isAdmin(groupId, actorId)) {
        return Promise.resolve('not_allowed' as const);
      }
      const entry = domains.get(`${groupId}#${domain}`);
      if (!entry) return Promise.resolve('not_found' as const);
      if (entry.type === type) return Promise.resolve('unchanged' as const);
      audit.push({
        groupId,
        action: 'RECLASSIFIED',
        domain,
        actorId,
        at,
        from: entry.type,
        to: type,
      });
      entry.type = type;
      bump(groupId);
      return Promise.resolve('changed' as const);
    },
    ruleState: (groupId) => {
      if (!groups.has(groupId)) return Promise.resolve(null);
      const list = [...domains.values()].filter((d) => d.groupId === groupId);
      return Promise.resolve({
        ruleVersion: ruleVersions.get(groupId) ?? 0,
        nonNegotiable: list
          .filter((d) => d.type === 'NON_NEGOTIABLE')
          .map((d) => d.domain)
          .sort(),
        additional: list
          .filter((d) => d.type === 'ADDITIONAL')
          .map((d) => d.domain)
          .sort(),
      });
    },
    recordNavigationEvent: ({ userId, groupId, eventId, now, cooldownSeconds, outbox: item }) => {
      if (seenEvents.has(`${userId}#${eventId}`)) return Promise.resolve('duplicate' as const);
      const key = memberKey(groupId, userId);
      const at = Date.parse(now);
      if ((cooldowns.get(key) ?? 0) > at) return Promise.resolve('cooldown' as const);
      if (!liveMember(groupId, userId)) return Promise.resolve('not_member' as const);
      seenEvents.add(`${userId}#${eventId}`);
      cooldowns.set(key, at + cooldownSeconds * 1000);
      outbox.set(item.outboxId, item);
      return Promise.resolve('recorded' as const);
    },
    isDeleted: (userId) => Promise.resolve(deletedUsers.has(userId)),
    deleteUserData: (userId) => {
      deletedUsers.add(userId);
      profiles.delete(userId);
      for (const key of [...rateCounters.keys()])
        if (key.startsWith(`${userId}#`)) rateCounters.delete(key);
      for (const key of [...seenEvents]) if (key.startsWith(`${userId}#`)) seenEvents.delete(key);
      return Promise.resolve();
    },
    getAccountability: (groupId) =>
      Promise.resolve({ sharing: inGroup(sharing, groupId), consents: inGroup(consents, groupId) }),
    setSharing: (groupId, userId, mode, recipientIds, at) => {
      if (!liveMember(groupId, userId)) return Promise.resolve('not_allowed' as const);
      sharing.set(memberKey(groupId, userId), {
        mode,
        recipients: Object.fromEntries(recipientIds.map((id) => [id, at])),
        updatedAt: at,
      });
      return Promise.resolve('saved' as const);
    },
    setAcceptAll: (groupId, userId, acceptAll) => {
      if (!liveMember(groupId, userId)) return Promise.resolve('not_allowed' as const);
      const key = memberKey(groupId, userId);
      consents.set(key, { senders: {}, ...consents.get(key), acceptAll });
      return Promise.resolve('saved' as const);
    },
    setSenderConsent: (groupId, recipientId, senderId, accepted, at) => {
      if (!liveMember(groupId, recipientId)) return Promise.resolve('not_allowed' as const);
      const key = memberKey(groupId, recipientId);
      const current = consents.get(key) ?? { acceptAll: false, senders: {} };
      const others = Object.entries(current.senders).filter(([id]) => id !== senderId);
      const senders = Object.fromEntries(accepted ? [...others, [senderId, at]] : others);
      consents.set(key, { ...current, senders });
      return Promise.resolve('saved' as const);
    },
  };
  return store;
}
