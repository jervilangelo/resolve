/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type {
  ConsentRecord,
  DomainType,
  GroupRole,
  OutboxItem,
  SharingMode,
  SharingRecord,
} from '@resolve/contracts';

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

/** `changed`: the departing member's sharing changed after the departure snapshot; recompute. */
export type RemoveResult = 'removed' | 'not_member' | 'last_admin' | 'not_allowed' | 'changed';

/** Trigger B: the outbox item plus the sharing version it was computed from. */
export interface Departure {
  outbox: OutboxItem;
  sharingUpdatedAt: string;
}

export interface StoredDomain {
  domain: string;
  type: DomainType;
  addedBy: string;
  createdAt: string;
}

export interface AddDomainInput extends StoredDomain {
  groupId: string;
  maxDomains: number;
}

export type AddDomainResult = 'added' | 'exists' | 'full' | 'not_allowed';

export interface DomainAuditEntry {
  action: 'ADDED' | 'REMOVED' | 'RECLASSIFIED';
  domain: string;
  actorId: string;
  at: string;
  from?: DomainType;
  to?: DomainType;
}

export interface RuleState {
  ruleVersion: number;
  nonNegotiable: string[];
  additional: string[];
}

export type StoredSharing = SharingRecord;
export type StoredConsent = ConsentRecord;

/** Writes need the caller to be a member of a live group when they commit. */
export type AccountabilityWrite = 'saved' | 'not_allowed';

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
  /** Fails with not_allowed unless the creator is an admin of a live group when it commits. */
  createInvitation(input: CreateInvitationInput): Promise<'created' | 'not_allowed'>;
  listInvitations(groupId: string, now: string): Promise<StoredInvitation[]>;
  /** Looks up a usable (unexpired, not used up) invitation by token hash. */
  findInvitation(
    tokenHash: string,
    now: string,
  ): Promise<(StoredInvitation & { groupName: string }) | null>;
  revokeInvitation(
    groupId: string,
    invitationId: string,
    actorId: string,
  ): Promise<'revoked' | 'not_found' | 'not_allowed'>;
  /** Atomically adds the member, counts the use and enforces expiry, use and group limits. */
  acceptInvitation(
    tokenHash: string,
    userId: string,
    now: string,
    maxMembers: number,
  ): Promise<AcceptResult>;
  /**
   * Removes a membership. `self` = leaving; otherwise `actorId` must be an admin and the target a
   * member. The last admin can never be removed or leave. The member's own sharing choice and
   * consent in the group are deleted with it, so rejoining starts private. `departure`, when given,
   * is the Trigger B outbox item, written in the same transaction (§7.2) and only if the member's
   * sharing is still the version it was computed from.
   */
  removeMember(
    groupId: string,
    userId: string,
    actorId: string,
    departure?: Departure,
  ): Promise<RemoveResult>;

  /** Renames a group; `actorId` must be an admin when the write commits. */
  renameGroup(groupId: string, name: string, actorId: string): Promise<'renamed' | 'not_allowed'>;
  /**
   * Promotes a member to admin or demotes an admin to member (including oneself). The group must
   * always keep at least one admin.
   */
  changeRole(
    groupId: string,
    userId: string,
    role: GroupRole,
    actorId: string,
  ): Promise<'changed' | 'unchanged' | 'not_member' | 'last_admin' | 'not_allowed' | 'conflict'>;
  /**
   * Deletes the group: the META item first (atomically with an admin check), so the group is gone
   * for everyone at once, then every remaining item in its partition and its invitation tokens.
   */
  dissolveGroup(groupId: string, actorId: string): Promise<'dissolved' | 'not_allowed'>;

  /**
   * Counts one action against the user's hourly budget; `bucket` names the action and hour, e.g.
   * `domains#2026-11-25T10`.
   * Charged before the list is consulted, so the budget never reveals whether a domain existed.
   */
  chargeSubmission(userId: string, bucket: string, maxPerHour: number): Promise<boolean>;
  /**
   * Adds a blocklist entry and bumps the group's ruleVersion atomically, with an audit record. The adder must be a
   * member of a live group (an admin for NON_NEGOTIABLE). An existing entry is left unchanged.
   */
  addDomain(input: AddDomainInput): Promise<AddDomainResult>;
  listDomains(groupId: string): Promise<StoredDomain[]>;
  /** Admin-only removal; bumps ruleVersion. */
  removeDomain(
    groupId: string,
    domain: string,
    actorId: string,
    at: string,
  ): Promise<'removed' | 'not_found' | 'not_allowed'>;
  /** Admin-only reclassification; bumps ruleVersion. */
  changeDomainType(
    groupId: string,
    domain: string,
    type: DomainType,
    actorId: string,
    at: string,
  ): Promise<'changed' | 'unchanged' | 'not_found' | 'not_allowed'>;
  /** Most recent domain changes first. */
  listDomainAudit(groupId: string, limit: number): Promise<DomainAuditEntry[]>;
  /** The group's current ruleVersion and blocklists, read consistently. */
  ruleState(groupId: string): Promise<RuleState | null>;

  /** Every member's sharing choice and consent in the group (absent = PRIVATE / none). */
  getAccountability(groupId: string): Promise<{
    sharing: Map<string, StoredSharing>;
    consents: Map<string, StoredConsent>;
  }>;
  /**
   * Trigger A (§7.1): atomically records the event ID (idempotency), starts the member's cooldown
   * for the group, checks live membership and writes the outbox item.
   */
  recordNavigationEvent(input: {
    userId: string;
    groupId: string;
    eventId: string;
    now: string;
    cooldownSeconds: number;
    outbox: OutboxItem;
  }): Promise<'recorded' | 'duplicate' | 'cooldown' | 'not_member'>;
  /** Replaces the caller's own sharing choice (with an audit record). */
  setSharing(
    groupId: string,
    userId: string,
    mode: SharingMode,
    recipientIds: string[],
    at: string,
  ): Promise<AccountabilityWrite>;
  /** The caller's own "accept from anyone who shares with me" consent. */
  setAcceptAll(
    groupId: string,
    userId: string,
    acceptAll: boolean,
    at: string,
  ): Promise<AccountabilityWrite>;
  /** The caller's own consent to receive one sender's alerts (given or withdrawn). */
  setSenderConsent(
    groupId: string,
    recipientId: string,
    senderId: string,
    accepted: boolean,
    at: string,
  ): Promise<AccountabilityWrite>;
}

export class InvalidCursorError extends Error {
  constructor() {
    super('Invalid cursor');
    this.name = 'InvalidCursorError';
  }
}
