/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
  EVENT_COOLDOWN_SECONDS,
  EVENT_MAX_AGE_SECONDS,
  EVENT_MAX_SKEW_SECONDS,
  EVENT_RECEIVED_RESPONSE,
  type OutboxItem,
  navigationEventRequestSchema,
  ACCOUNTABILITY_CHANGES_PER_HOUR,
  type AlertTypePrefs,
  type CreatedInstallation,
  createInstallationRequestSchema,
  installationIdSchema,
  installationRemovedRequestSchema,
  updateAlertTypesRequestSchema,
  type AccountabilityView,
  updateReceivingRequestSchema,
  updateSharingRequestSchema,
  type AddedDomain,
  type CreatedInvitation,
  DOMAIN_SUBMISSIONS_PER_HOUR,
  type GroupDomainList,
  MAX_GROUP_DOMAINS,
  MEMBER_SUBMISSION_RESPONSE,
  type DomainAuditList,
  type RuleSnapshot,
  addDomainRequestSchema,
  ruleQuerySchema,
  updateDomainRequestSchema,
  type GroupList,
  type GroupSummary,
  type HealthResponse,
  INVITATION_TTL_DAYS,
  type InvitationPreview,
  MAX_GROUP_MEMBERS,
  type MemberList,
  type Profile,
  createGroupRequestSchema,
  createInvitationRequestSchema,
  groupIdSchema,
  idempotencyKeySchema,
  invitationIdSchema,
  type invitationListSchema,
  invitationTokenRequestSchema,
  pageQuerySchema,
  updateGroupRequestSchema,
  updateMemberRoleRequestSchema,
  updateProfileRequestSchema,
  userIdSchema,
} from '@resolve/contracts';
import {
  ESSENTIAL_VERSION,
  essentialDomains,
  normalizeDomain,
  validateBlockedDomain,
} from '@resolve/domain-policy';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { z } from 'zod';
import { accountabilityView, eligibleRecipients } from './accountability';
import {
  installationOutbox,
  newInstallationId,
  newInstallationToken,
  silenceDeadline,
} from './installations';
import { requireIdentity } from './auth';
import type { ApiEnv } from './env';
import { ApiError, type Route } from './http';
import { header, parseBody, parseOrReject } from './request';
import {
  type Departure,
  InvalidCursorError,
  type RemoveResult,
  type Store,
  type StoredMembership,
} from './store/store';

export interface RouteDeps {
  env: ApiEnv;
  store: Store;
  /** Deletes the sign-in account itself (Cognito); absent where accounts cannot be deleted. */
  deleteIdentity?: (userId: string) => Promise<void>;
  now?: () => Date;
  newGroupId?: () => string;
}

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

/** `<prefix>_` + 26 random base32 characters (130 bits). */
function randomId(prefix: string): string {
  return `${prefix}_${Array.from(randomBytes(26), (byte) => BASE32[byte % 32] ?? 'a').join('')}`;
}

export const generateGroupId = () => randomId('grp');
const generateOutboxId = () => randomId('out');

/** Invitation tokens are stored only as SHA-256 hashes (§3). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A canonical domain from the path; anything non-canonical is simply not found. */
function pathDomain(event: APIGatewayProxyEventV2): string {
  const raw = event.pathParameters?.domain ?? '';
  const normalized = normalizeDomain(raw);
  if (!normalized.ok || normalized.domain !== raw) throw new ApiError('NOT_FOUND');
  return normalized.domain;
}

function bodyTokenHash(event: APIGatewayProxyEventV2): string {
  return hashToken(parseBody(event, invitationTokenRequestSchema).token);
}

function summary(m: StoredMembership): GroupSummary {
  return { groupId: m.groupId, name: m.groupName, role: m.role, createdAt: m.groupCreatedAt };
}

function pathGroupId(event: APIGatewayProxyEventV2): string {
  // Malformed IDs get the same 404 as missing or inaccessible groups (no existence oracle).
  const result = groupIdSchema.safeParse(event.pathParameters?.groupId);
  if (!result.success) throw new ApiError('NOT_FOUND');
  return result.data;
}

/** Routes authorised by something other than a sign-in token (none, or an installation token). */
const TOKEN_ROUTES = new Set([
  'GET /v1/health',
  'POST /v1/installations/removed',
  'POST /v1/installations/revoke',
]);

/** Routes keyed by API Gateway route key; identical keys are declared in Terraform. */
export function createRoutes(deps: RouteDeps): Record<string, Route> {
  const { env, store } = deps;
  const now = deps.now ?? (() => new Date());
  const newGroupId = deps.newGroupId ?? generateGroupId;
  const identity = (event: APIGatewayProxyEventV2) =>
    requireIdentity(event, env.ALLOWED_CLIENT_IDS);

  /** Membership in a live group, or null (dissolved groups may leave inert rows behind). */
  async function liveMembership(groupId: string, userId: string) {
    const [membership, group] = await Promise.all([
      store.getMembership(groupId, userId),
      store.getGroup(groupId),
    ]);
    return membership && group ? { membership, group } : null;
  }

  /** The caller's membership; non-members get the same 404 as missing groups. */
  async function requireMember(event: APIGatewayProxyEventV2) {
    const { userId } = identity(event);
    const groupId = pathGroupId(event);
    const live = await liveMembership(groupId, userId);
    if (!live) throw new ApiError('NOT_FOUND');
    return { groupId, userId, ...live };
  }

  /** Every current member, across pages (a group normally holds at most MAX_GROUP_MEMBERS). */
  async function allMembers(groupId: string) {
    const members = [];
    let cursor: string | undefined;
    do {
      const page = await store.listMembers(groupId, MAX_GROUP_MEMBERS, cursor);
      members.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return members;
  }

  /** The caller's own accountability view, computed from current members and choices. */
  async function ownView(groupId: string, userId: string) {
    const [members, state] = await Promise.all([
      allMembers(groupId),
      store.getAccountability(groupId),
    ]);
    const body: AccountabilityView = accountabilityView(userId, members, state);
    return { status: 200, body };
  }

  /**
   * Charges one accountability change to the caller's hourly budget. Saves that would change
   * nothing are answered before this, so they neither write nor count.
   */
  async function chargeAccountabilityChange(userId: string) {
    const bucket = `accountability#${now().toISOString().slice(0, 13)}`;
    if (!(await store.chargeSubmission(userId, bucket, ACCOUNTABILITY_CHANGES_PER_HOUR))) {
      throw new ApiError('RATE_LIMITED');
    }
  }

  /**
   * Trigger B snapshot (§7.2): who should learn that `userId` left, from the sharing and consents
   * as they stand *before* the departure. Null when nobody qualifies (e.g. the member was PRIVATE).
   */
  async function departureOutbox(
    groupId: string,
    groupName: string,
    userId: string,
  ): Promise<Departure | undefined> {
    const [members, state] = await Promise.all([
      allMembers(groupId),
      store.getAccountability(groupId),
    ]);
    const sender = members.find((m) => m.userId === userId);
    const recipientIds = eligibleRecipients(userId, members, state);
    const sharing = state.sharing.get(userId);
    if (!sender || !sharing?.updatedAt || recipientIds.length === 0) return undefined;
    const outbox: OutboxItem = {
      outboxId: generateOutboxId(),
      kind: 'GROUP_DEPARTURE',
      groupId,
      groupName,
      senderId: userId,
      senderName: sender.displayName,
      senderJoinedAt: sender.joinedAt,
      departureSharing: { mode: sharing.mode, recipients: sharing.recipients },
      recipientIds,
      createdAt: now().toISOString(),
    };
    return { outbox, sharingUpdatedAt: sharing.updatedAt };
  }

  /**
   * Ends a membership with its departure alert. If the member's sharing changes between snapshot
   * and commit, the snapshot is recomputed (a few times at most).
   */
  async function depart(
    groupId: string,
    groupName: string,
    userId: string,
    actorId: string,
  ): Promise<RemoveResult> {
    for (let attempt = 0; ; attempt++) {
      const departure = await departureOutbox(groupId, groupName, userId);
      const result = await store.removeMember(groupId, userId, actorId, departure);
      if (result !== 'changed') return result;
      if (attempt >= 2) throw new ApiError('CONFLICT');
    }
  }

  /** A fellow member from the path (never the caller); anyone else is simply not found. */
  async function pathFellowMember(
    event: APIGatewayProxyEventV2,
    groupId: string,
    callerId: string,
  ): Promise<string> {
    const target = userIdSchema.safeParse(event.pathParameters?.userId);
    if (!target.success || target.data === callerId) throw new ApiError('NOT_FOUND');
    if (!(await store.getMembership(groupId, target.data))) throw new ApiError('NOT_FOUND');
    return target.data;
  }

  /** Members already know the group exists, so a missing admin role is 403. */
  async function requireAdmin(event: APIGatewayProxyEventV2) {
    const member = await requireMember(event);
    if (member.membership.role !== 'ADMIN') throw new ApiError('FORBIDDEN');
    return member;
  }

  const routes: Record<string, Route> = {
    'GET /v1/health': () => {
      const body: HealthResponse = { status: 'ok', service: 'resolve-api', stage: env.STAGE };
      return Promise.resolve({ status: 200, body });
    },

    'GET /v1/me': async (event) => {
      const { userId } = identity(event);
      const profile = await store.getProfile(userId);
      const body: Profile = { userId, displayName: profile?.displayName ?? null };
      return { status: 200, body };
    },

    'PATCH /v1/me': async (event) => {
      const { userId } = identity(event);
      const input = parseBody(event, updateProfileRequestSchema);
      await store.putProfile(userId, { displayName: input.displayName });
      const body: Profile = { userId, displayName: input.displayName };
      return { status: 200, body };
    },

    // Self-service account deletion (privacy policy; MASTER_PLAN §13). Leaves every group through
    // the normal departure path (so departure alerts follow the member's own sharing), dissolves
    // groups where they are the only member, then deletes their data and their sign-in.
    'DELETE /v1/me': async (event) => {
      const { userId } = identity(event);
      if (!deps.deleteIdentity) throw new ApiError('INTERNAL');
      const listAll = async () => {
        const memberships: StoredMembership[] = [];
        let cursor: string | undefined;
        do {
          const page = await store.listMemberships(userId, 100, cursor);
          memberships.push(...page.items);
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
        return memberships;
      };

      // Never leave a group without an admin: the only admin of a group with other members must
      // hand over or dissolve it first. Checked for every group before anything changes.
      const leaveAll = async (memberships: StoredMembership[]) => {
        const plan: { membership: StoredMembership; alone: boolean }[] = [];
        for (const membership of memberships) {
          const members = await allMembers(membership.groupId);
          const others = members.filter((m) => m.userId !== userId);
          const otherAdmins = others.filter((m) => m.role === 'ADMIN');
          if (membership.role === 'ADMIN' && others.length > 0 && otherAdmins.length === 0) {
            throw new ApiError('CONFLICT');
          }
          plan.push({ membership, alone: others.length === 0 });
        }
        for (const { membership, alone } of plan) {
          if (alone && membership.role === 'ADMIN') {
            // Only if still alone when it commits; someone who just joined keeps the group.
            const dissolved = await store.dissolveGroup(membership.groupId, userId, {
              onlyIfSolo: true,
            });
            if (dissolved === 'dissolved') continue;
          }
          const result = await depart(membership.groupId, membership.groupName, userId, userId);
          if (result === 'last_admin') throw new ApiError('CONFLICT');
        }
      };

      // The membership index is eventually consistent: list again until nothing is left, so a
      // group joined moments ago is not missed.
      for (let pass = 0; pass < 3; pass++) {
        const memberships = await listAll();
        if (memberships.length === 0) break;
        await leaveAll(memberships);
      }
      await store.deleteUserData(userId);
      await deps.deleteIdentity(userId);
      return { status: 204, body: undefined };
    },

    'POST /v1/groups': async (event) => {
      const { userId } = identity(event);
      const input = parseBody(event, createGroupRequestSchema);
      const rawKey = header(event, 'idempotency-key');
      const idempotencyKey =
        rawKey === undefined ? undefined : parseOrReject(idempotencyKeySchema, rawKey);
      const { groupId, created } = await store.createGroup({
        groupId: newGroupId(),
        name: input.name,
        ownerId: userId,
        createdAt: now().toISOString(),
        idempotencyKey,
      });
      // A replayed request whose group was since dissolved (or left) no longer has a group.
      const live = await liveMembership(groupId, userId);
      if (!live) throw new ApiError('NOT_FOUND');
      return {
        status: created ? 201 : 200,
        body: summary({ ...live.membership, groupName: live.group.name }),
      };
    },

    'GET /v1/groups': async (event) => {
      const { userId } = identity(event);
      const query = parseOrReject(pageQuerySchema, event.queryStringParameters ?? {});
      try {
        const page = await store.listMemberships(userId, query.limit, query.cursor);
        const body: GroupList = { items: page.items.map(summary), nextCursor: page.nextCursor };
        return { status: 200, body };
      } catch (error) {
        if (error instanceof InvalidCursorError) throw new ApiError('VALIDATION_FAILED');
        throw error;
      }
    },

    'GET /v1/groups/{groupId}': async (event) => {
      const { userId } = identity(event);
      const groupId = pathGroupId(event);
      const membership = await store.getMembership(groupId, userId);
      if (!membership) throw new ApiError('NOT_FOUND');
      const group = await store.getGroup(groupId);
      if (!group) throw new ApiError('NOT_FOUND');
      const body: GroupSummary = {
        groupId,
        name: group.name,
        role: membership.role,
        createdAt: group.createdAt,
      };
      return { status: 200, body };
    },

    'GET /v1/groups/{groupId}/members': async (event) => {
      const { groupId, userId } = await requireMember(event);
      const query = parseOrReject(pageQuerySchema, event.queryStringParameters ?? {});
      try {
        const page = await store.listMembers(groupId, query.limit, query.cursor);
        // Re-check after the read: a caller removed (or a group dissolved) mid-request must not
        // see the result.
        if (!(await liveMembership(groupId, userId))) throw new ApiError('NOT_FOUND');
        const body: MemberList = page;
        return { status: 200, body };
      } catch (error) {
        if (error instanceof InvalidCursorError) throw new ApiError('VALIDATION_FAILED');
        throw error;
      }
    },

    'POST /v1/groups/{groupId}/invitations': async (event) => {
      const { groupId, userId } = await requireAdmin(event);
      const input = parseBody(event, createInvitationRequestSchema);
      const token = randomBytes(32).toString('base64url');
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + INVITATION_TTL_DAYS * 86_400_000);
      const invitation = {
        invitationId: randomId('inv'),
        groupId,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        maxUses: input.maxUses,
        uses: 0,
      };
      const created = await store.createInvitation({
        ...invitation,
        tokenHash: hashToken(token),
        createdBy: userId,
      });
      if (created !== 'created') throw new ApiError('FORBIDDEN');
      const body: CreatedInvitation = {
        invitationId: invitation.invitationId,
        token,
        expiresAt: invitation.expiresAt,
        maxUses: invitation.maxUses,
      };
      return { status: 201, body };
    },

    'GET /v1/groups/{groupId}/invitations': async (event) => {
      const { groupId, userId } = await requireAdmin(event);
      const items = await store.listInvitations(groupId, now().toISOString());
      const still = await liveMembership(groupId, userId);
      if (still?.membership.role !== 'ADMIN') throw new ApiError('NOT_FOUND');
      const body: z.infer<typeof invitationListSchema> = {
        items: items.map(({ invitationId, createdAt, expiresAt, maxUses, uses }) => ({
          invitationId,
          createdAt,
          expiresAt,
          maxUses,
          uses,
        })),
        nextCursor: null,
      };
      return { status: 200, body };
    },

    'DELETE /v1/groups/{groupId}/invitations/{invitationId}': async (event) => {
      const { groupId, userId } = await requireAdmin(event);
      const id = invitationIdSchema.safeParse(event.pathParameters?.invitationId);
      if (!id.success) throw new ApiError('NOT_FOUND');
      const result = await store.revokeInvitation(groupId, id.data, userId);
      if (result === 'not_found') throw new ApiError('NOT_FOUND');
      if (result === 'not_allowed') throw new ApiError('FORBIDDEN');
      return { status: 204, body: undefined };
    },

    'POST /v1/invitations/preview': async (event) => {
      identity(event);
      const invitation = await store.findInvitation(bodyTokenHash(event), now().toISOString());
      if (!invitation) throw new ApiError('NOT_FOUND');
      const body: InvitationPreview = {
        groupName: invitation.groupName,
        expiresAt: invitation.expiresAt,
      };
      return { status: 200, body };
    },

    'POST /v1/invitations/accept': async (event) => {
      const { userId } = identity(event);
      const result = await store.acceptInvitation(
        bodyTokenHash(event),
        userId,
        now().toISOString(),
        MAX_GROUP_MEMBERS,
      );
      if (result.status === 'invalid') throw new ApiError('NOT_FOUND');
      if (result.status === 'full') throw new ApiError('CONFLICT');
      if (result.status === 'joined') {
        // Answer from the committed transaction, not a re-read that a removal could race.
        const body: GroupSummary = {
          groupId: result.groupId,
          name: result.groupName,
          role: 'MEMBER',
          createdAt: result.groupCreatedAt,
        };
        return { status: 201, body };
      }
      const live = await liveMembership(result.groupId, userId);
      if (!live) throw new ApiError('NOT_FOUND');
      return { status: 200, body: summary({ ...live.membership, groupName: live.group.name }) };
    },

    // ---- Accountability (§6): every route acts on the caller's own choices only. Admins have
    // no route to read or change another member's sharing or consent.

    'GET /v1/groups/{groupId}/accountability': async (event) => {
      const { groupId, userId } = await requireMember(event);
      return ownView(groupId, userId);
    },

    'PUT /v1/groups/{groupId}/accountability/sharing': async (event) => {
      const { groupId, userId } = await requireMember(event);
      const { mode, recipientIds } = parseBody(event, updateSharingRequestSchema);
      if (recipientIds.length > 0) {
        const memberIds = new Set((await allMembers(groupId)).map((m) => m.userId));
        // Recipients must be current fellow members (never yourself or outsiders).
        if (recipientIds.some((id) => id === userId || !memberIds.has(id))) {
          throw new ApiError('VALIDATION_FAILED');
        }
      }
      const current = (await ownView(groupId, userId)).body.sharing;
      if (
        current.mode === mode &&
        [...current.recipientIds].sort().join() === [...recipientIds].sort().join()
      ) {
        return ownView(groupId, userId);
      }
      await chargeAccountabilityChange(userId);
      const result = await store.setSharing(
        groupId,
        userId,
        mode,
        recipientIds,
        now().toISOString(),
      );
      if (result === 'not_allowed') throw new ApiError('NOT_FOUND');
      return ownView(groupId, userId);
    },

    'PUT /v1/groups/{groupId}/accountability/receiving': async (event) => {
      const { groupId, userId } = await requireMember(event);
      const { acceptAll } = parseBody(event, updateReceivingRequestSchema);
      if ((await ownView(groupId, userId)).body.receiving.acceptAll === acceptAll) {
        return ownView(groupId, userId);
      }
      await chargeAccountabilityChange(userId);
      const result = await store.setAcceptAll(groupId, userId, acceptAll, now().toISOString());
      if (result === 'not_allowed') throw new ApiError('NOT_FOUND');
      return ownView(groupId, userId);
    },

    'PUT /v1/groups/{groupId}/accountability/senders/{userId}': async (event) => {
      // The caller agrees to receive this member's alerts.
      const { groupId, userId } = await requireMember(event);
      const senderId = await pathFellowMember(event, groupId, userId);
      await chargeAccountabilityChange(userId);
      const result = await store.setSenderConsent(
        groupId,
        userId,
        senderId,
        true,
        now().toISOString(),
      );
      if (result === 'not_allowed') throw new ApiError('NOT_FOUND');
      return ownView(groupId, userId);
    },

    'DELETE /v1/groups/{groupId}/accountability/senders/{userId}': async (event) => {
      // Withdrawal always works, even for someone who has since left.
      const { groupId, userId } = await requireMember(event);
      const sender = userIdSchema.safeParse(event.pathParameters?.userId);
      if (!sender.success) throw new ApiError('NOT_FOUND');
      const consent = (await store.getAccountability(groupId)).consents.get(userId);
      if (!consent || !(sender.data in consent.senders)) return ownView(groupId, userId);
      await chargeAccountabilityChange(userId);
      const result = await store.setSenderConsent(
        groupId,
        userId,
        sender.data,
        false,
        now().toISOString(),
      );
      if (result === 'not_allowed') throw new ApiError('NOT_FOUND');
      return ownView(groupId, userId);
    },

    'PUT /v1/groups/{groupId}/accountability/alert-types': async (event) => {
      // The caller's own installation-alert choices (§7.4): which types they share, and which
      // they agree to receive. Off by default; unspecified choices stay as they are.
      const { groupId, userId } = await requireMember(event);
      const input = parseBody(event, updateAlertTypesRequestSchema);
      const current = (await ownView(groupId, userId)).body.alertTypes;
      const next: AlertTypePrefs = {
        share: { ...current.share, ...input.share },
        receive: { ...current.receive, ...input.receive },
      };
      if (JSON.stringify(next) === JSON.stringify(current)) return ownView(groupId, userId);
      await chargeAccountabilityChange(userId);
      const result = await store.setAlertTypes(groupId, userId, next, now().toISOString());
      if (result === 'not_allowed') throw new ApiError('NOT_FOUND');
      return ownView(groupId, userId);
    },

    'POST /v1/extension/installations': async (event) => {
      // Enrols this browser for installation alerts (§7.4); only the extension can do this.
      const { userId, clientId } = identity(event);
      if (!env.RULES_CLIENT_IDS.includes(clientId)) throw new ApiError('FORBIDDEN');
      const { groupId } = parseBody(event, createInstallationRequestSchema);
      if (!(await liveMembership(groupId, userId))) throw new ApiError('NOT_FOUND');
      const at = now();
      const token = newInstallationToken();
      const body: CreatedInstallation = { installationId: newInstallationId(), token };
      const created = await store.createInstallation({
        userId,
        installationId: body.installationId,
        groupId,
        tokenHash: hashToken(token),
        now: at.toISOString(),
        dueAt: silenceDeadline(at),
      });
      if (created === 'not_member') throw new ApiError('NOT_FOUND');
      return { status: 201, body };
    },

    'POST /v1/extension/installations/{installationId}/checkin': async (event) => {
      const { userId, clientId } = identity(event);
      if (!env.RULES_CLIENT_IDS.includes(clientId)) throw new ApiError('FORBIDDEN');
      const id = installationIdSchema.safeParse(event.pathParameters?.installationId);
      if (!id.success) throw new ApiError('NOT_FOUND');
      const installation = await store.getInstallation(userId, id.data);
      if (installation?.status !== 'ACTIVE') throw new ApiError('NOT_FOUND');
      // Left the group: the enrolment ends with it (the extension enrols again for a new group).
      if (!(await liveMembership(installation.groupId, userId))) {
        await store.deleteInstallation(userId, id.data);
        throw new ApiError('NOT_FOUND');
      }
      const at = now();
      const result = await store.checkInInstallation(
        userId,
        id.data,
        at.toISOString(),
        silenceDeadline(at),
      );
      if (result === 'not_found') throw new ApiError('NOT_FOUND');
      return { status: 204, body: undefined };
    },

    'POST /v1/installations/revoke': async (event) => {
      // Sign-out, alerts turned off or a group switch. The installation's own token is the
      // credential, so the extension can still revoke (and retry) after the sign-in has ended.
      const { token } = parseBody(event, installationRemovedRequestSchema);
      const installation = await store.findInstallationByToken(hashToken(token));
      if (installation?.status === 'ACTIVE') {
        await store.deleteInstallation(installation.userId, installation.installationId);
      }
      return { status: 204, body: undefined };
    },

    'POST /v1/installations/removed': async (event) => {
      // The uninstall-URL callback, relayed by the website. The token is the only credential: the
      // extension is gone and cannot sign in. Every request gets the same answer (no oracle).
      const accepted = { status: 202, body: EVENT_RECEIVED_RESPONSE };
      const { token } = parseBody(event, installationRemovedRequestSchema);
      const installation = await store.findInstallationByToken(hashToken(token));
      if (installation?.status !== 'ACTIVE') return accepted;
      if (await store.isDeleted(installation.userId)) return accepted;
      const at = now();
      const outbox = await installationOutbox(
        store,
        installation,
        'EXTENSION_REMOVED',
        at.toISOString(),
        at,
      );
      // A repeated callback finds the installation already removed and changes nothing.
      await store.markInstallationRemoved(installation, at.toISOString(), outbox);
      return accepted;
    },

    'POST /v1/groups/{groupId}/leave': async (event) => {
      const { groupId, userId, group } = await requireMember(event);
      const result = await depart(groupId, group.name, userId, userId);
      // The last admin must first make another member an admin, or dissolve the group (§3).
      if (result === 'last_admin') throw new ApiError('CONFLICT');
      if (result === 'not_member') throw new ApiError('NOT_FOUND');
      return { status: 204, body: undefined };
    },

    'PATCH /v1/groups/{groupId}': async (event) => {
      const { groupId, userId, group } = await requireAdmin(event);
      const input = parseBody(event, updateGroupRequestSchema);
      if ((await store.renameGroup(groupId, input.name, userId)) !== 'renamed') {
        throw new ApiError('FORBIDDEN');
      }
      // Built from the committed name rather than a read that could predate the write.
      const body: GroupSummary = {
        groupId,
        name: input.name,
        role: 'ADMIN',
        createdAt: group.createdAt,
      };
      return { status: 200, body };
    },

    'DELETE /v1/groups/{groupId}': async (event) => {
      const { groupId, userId } = await requireAdmin(event);
      if ((await store.dissolveGroup(groupId, userId)) !== 'dissolved') {
        throw new ApiError('FORBIDDEN');
      }
      return { status: 204, body: undefined };
    },

    'PATCH /v1/groups/{groupId}/members/{userId}': async (event) => {
      // Only admins change roles; an admin may also step down if another admin remains.
      const { groupId, userId } = await requireAdmin(event);
      const target = userIdSchema.safeParse(event.pathParameters?.userId);
      if (!target.success) throw new ApiError('NOT_FOUND');
      const { role } = parseBody(event, updateMemberRoleRequestSchema);
      const result = await store.changeRole(groupId, target.data, role, userId);
      if (result === 'not_member') throw new ApiError('NOT_FOUND');
      if (result === 'last_admin' || result === 'conflict') throw new ApiError('CONFLICT');
      if (result === 'not_allowed') throw new ApiError('FORBIDDEN');
      return { status: 204, body: undefined };
    },

    'POST /v1/groups/{groupId}/domains': async (event) => {
      const { groupId, userId, membership } = await requireMember(event);
      const isAdmin = membership.role === 'ADMIN';
      const input = parseBody(event, addDomainRequestSchema);
      const type = input.type ?? 'ADDITIONAL';
      // Only admins manage non-negotiable entries (§3); this is a role check, not a list oracle.
      if (type === 'NON_NEGOTIABLE' && !isAdmin) throw new ApiError('FORBIDDEN');
      // Invalid and essential domains get the same generic rejection.
      const validated = validateBlockedDomain(input.domain);
      if (!validated.ok) throw new ApiError('VALIDATION_FAILED');
      const createdAt = now().toISOString();
      // Every valid submission is charged before the list is consulted, so the rate limit can never
      // reveal whether a domain was already listed.
      const allowed = await store.chargeSubmission(
        userId,
        `domains#${createdAt.slice(0, 13)}`,
        DOMAIN_SUBMISSIONS_PER_HOUR,
      );
      if (!allowed) throw new ApiError('RATE_LIMITED');
      const result = await store.addDomain({
        groupId,
        domain: validated.domain,
        type,
        addedBy: userId,
        createdAt,
        maxDomains: MAX_GROUP_DOMAINS,
      });
      if (result === 'not_allowed') throw new ApiError(isAdmin ? 'FORBIDDEN' : 'NOT_FOUND');
      if (!isAdmin) {
        // The same answer whether the domain was new, already listed in any category, or the list
        // is full (section 11): members learn nothing about what the list contains.
        return { status: 202, body: MEMBER_SUBMISSION_RESPONSE };
      }
      if (result === 'exists' || result === 'full') throw new ApiError('CONFLICT');
      const body: AddedDomain = {
        domain: validated.domain,
        type,
        addedBy: userId,
        createdAt,
        exempted: validated.exempted,
      };
      return { status: 201, body };
    },

    'GET /v1/groups/{groupId}/domains': async (event) => {
      const { groupId, userId } = await requireAdmin(event);
      const items = await store.listDomains(groupId);
      // Re-check: only a current admin may see the full list (§4.3).
      const still = await liveMembership(groupId, userId);
      if (still?.membership.role !== 'ADMIN') throw new ApiError('NOT_FOUND');
      const body: GroupDomainList = { items, nextCursor: null };
      return { status: 200, body };
    },

    'DELETE /v1/groups/{groupId}/domains/{domain}': async (event) => {
      const { groupId, userId } = await requireAdmin(event);
      const at = now().toISOString();
      const result = await store.removeDomain(groupId, pathDomain(event), userId, at);
      if (result === 'not_found') throw new ApiError('NOT_FOUND');
      if (result === 'not_allowed') throw new ApiError('FORBIDDEN');
      return { status: 204, body: undefined };
    },

    'PATCH /v1/groups/{groupId}/domains/{domain}': async (event) => {
      const { groupId, userId } = await requireAdmin(event);
      const domain = pathDomain(event);
      const { type } = parseBody(event, updateDomainRequestSchema);
      const at = now().toISOString();
      const result = await store.changeDomainType(groupId, domain, type, userId, at);
      if (result === 'not_found') throw new ApiError('NOT_FOUND');
      if (result === 'not_allowed') throw new ApiError('FORBIDDEN');
      return { status: 204, body: undefined };
    },

    'GET /v1/groups/{groupId}/domains/audit': async (event) => {
      const { groupId, userId } = await requireAdmin(event);
      const items = await store.listDomainAudit(groupId, 50);
      const still = await liveMembership(groupId, userId);
      if (still?.membership.role !== 'ADMIN') throw new ApiError('NOT_FOUND');
      const body: DomainAuditList = { items };
      return { status: 200, body };
    },

    // Trigger A (§7.1): the extension reports a blocked non-negotiable navigation. Every accepted
    // request gets the same 202, so the response reveals nothing about recipients or cooldowns.
    'POST /v1/events': async (event) => {
      const { userId, clientId } = identity(event);
      if (!env.RULES_CLIENT_IDS.includes(clientId)) throw new ApiError('FORBIDDEN');
      const input = parseBody(event, navigationEventRequestSchema);
      const accepted = { status: 202, body: EVENT_RECEIVED_RESPONSE };
      const at = now();
      const age = (at.getTime() - Date.parse(input.occurredAt)) / 1000;
      if (age > EVENT_MAX_AGE_SECONDS || age < -EVENT_MAX_SKEW_SECONDS) return accepted;

      const live = await liveMembership(input.groupId, userId);
      if (!live) throw new ApiError('NOT_FOUND');
      const [members, state] = await Promise.all([
        allMembers(input.groupId),
        store.getAccountability(input.groupId),
      ]);
      const sender = members.find((m) => m.userId === userId);
      const recipientIds = eligibleRecipients(userId, members, state);
      // Nobody may receive it: nothing is recorded at all (no event history is kept).
      if (!sender || recipientIds.length === 0) return accepted;
      await store.recordNavigationEvent({
        userId,
        groupId: input.groupId,
        eventId: input.eventId,
        now: at.toISOString(),
        cooldownSeconds: EVENT_COOLDOWN_SECONDS,
        outbox: {
          outboxId: generateOutboxId(),
          kind: 'NON_NEGOTIABLE_NAVIGATION',
          groupId: input.groupId,
          groupName: live.group.name,
          senderId: userId,
          senderName: sender.displayName,
          senderJoinedAt: sender.joinedAt,
          recipientIds,
          createdAt: at.toISOString(),
        },
      });
      // Duplicates, cooldowns and a membership that just ended all look the same to the caller.
      return accepted;
    },

    'GET /v1/extension/rules': async (event) => {
      const { userId, clientId } = identity(event);
      // Rules are for the extension to enforce, not for reading: dashboard tokens cannot fetch
      // them, so the standard UI and API never enumerate the list (section 4.3, FR-09).
      if (!env.RULES_CLIENT_IDS.includes(clientId)) throw new ApiError('FORBIDDEN');
      const query = parseOrReject(ruleQuerySchema, event.queryStringParameters ?? {});
      // Only active members of a live group receive its enforcement rules (§4.3).
      if (!(await liveMembership(query.groupId, userId))) throw new ApiError('NOT_FOUND');
      const rules = await store.ruleState(query.groupId);
      if (!rules || !(await liveMembership(query.groupId, userId))) throw new ApiError('NOT_FOUND');
      const base = {
        groupId: query.groupId,
        ruleVersion: rules.ruleVersion,
        essentialVersion: ESSENTIAL_VERSION,
      };
      const unchanged =
        query.version === rules.ruleVersion && query.essentialVersion === ESSENTIAL_VERSION;
      const body: RuleSnapshot = unchanged
        ? { status: 'unchanged', ...base }
        : {
            status: 'current',
            ...base,
            essential: essentialDomains(),
            nonNegotiable: rules.nonNegotiable,
            additional: rules.additional,
          };
      return { status: 200, body };
    },

    'DELETE /v1/groups/{groupId}/members/{userId}': async (event) => {
      const { groupId, userId, group } = await requireAdmin(event);
      const target = userIdSchema.safeParse(event.pathParameters?.userId);
      if (!target.success) throw new ApiError('NOT_FOUND');
      // Admins leave through /leave, which applies the last-admin rule.
      if (target.data === userId) throw new ApiError('CONFLICT');
      const result = await depart(groupId, group.name, target.data, userId);
      if (result === 'not_member') throw new ApiError('NOT_FOUND');
      if (result !== 'removed') throw new ApiError('FORBIDDEN');
      return { status: 204, body: undefined };
    },
  };

  // A deleted account's tokens can outlive it by up to an hour: refuse them everywhere, so nothing
  // is recreated for an account that no longer exists.
  return Object.fromEntries(
    Object.entries(routes).map(([key, route]): [string, Route] => [
      key,
      TOKEN_ROUTES.has(key)
        ? route
        : async (event, context) => {
            if (await store.isDeleted(identity(event).userId)) {
              throw new ApiError('UNAUTHENTICATED');
            }
            return route(event, context);
          },
    ]),
  );
}

/** Dispatch on API Gateway's route key; unknown routes are 404. */
export function createRouter(routes: Record<string, Route>): Route {
  return (event, context) => {
    const route = routes[event.routeKey];
    if (!route) return Promise.reject(new ApiError('NOT_FOUND'));
    return route(event, context);
  };
}
