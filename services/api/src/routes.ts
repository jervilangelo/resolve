/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
  type CreatedInvitation,
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
  updateProfileRequestSchema,
  userIdSchema,
} from '@resolve/contracts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { z } from 'zod';
import { requireIdentity } from './auth';
import type { ApiEnv } from './env';
import { ApiError, type Route } from './http';
import { header, parseBody, parseOrReject } from './request';
import { InvalidCursorError, type Store, type StoredMembership } from './store/store';

export interface RouteDeps {
  env: ApiEnv;
  store: Store;
  now?: () => Date;
  newGroupId?: () => string;
}

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

/** `<prefix>_` + 26 random base32 characters (130 bits). */
function randomId(prefix: string): string {
  return `${prefix}_${Array.from(randomBytes(26), (byte) => BASE32[byte % 32] ?? 'a').join('')}`;
}

export const generateGroupId = () => randomId('grp');

/** Invitation tokens are stored only as SHA-256 hashes (§3). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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

/** Routes keyed by API Gateway route key; identical keys are declared in Terraform. */
export function createRoutes(deps: RouteDeps): Record<string, Route> {
  const { env, store } = deps;
  const now = deps.now ?? (() => new Date());
  const newGroupId = deps.newGroupId ?? generateGroupId;
  const identity = (event: APIGatewayProxyEventV2) =>
    requireIdentity(event, env.ALLOWED_CLIENT_IDS);

  /** The caller's membership; non-members get the same 404 as missing groups. */
  async function requireMember(event: APIGatewayProxyEventV2) {
    const { userId } = identity(event);
    const groupId = pathGroupId(event);
    const membership = await store.getMembership(groupId, userId);
    if (!membership) throw new ApiError('NOT_FOUND');
    return { groupId, userId, membership };
  }

  /** Members already know the group exists, so a missing admin role is 403. */
  async function requireAdmin(event: APIGatewayProxyEventV2) {
    const member = await requireMember(event);
    if (member.membership.role !== 'ADMIN') throw new ApiError('FORBIDDEN');
    return member;
  }

  return {
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
      const membership = await store.getMembership(groupId, userId);
      if (!membership) throw new Error('Membership missing after group creation');
      return { status: created ? 201 : 200, body: summary(membership) };
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
        // Re-check after the read: a caller removed mid-request must not see the result.
        if (!(await store.getMembership(groupId, userId))) throw new ApiError('NOT_FOUND');
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
      await store.createInvitation({
        ...invitation,
        tokenHash: hashToken(token),
        createdBy: userId,
      });
      const body: CreatedInvitation = {
        invitationId: invitation.invitationId,
        token,
        expiresAt: invitation.expiresAt,
        maxUses: invitation.maxUses,
      };
      return { status: 201, body };
    },

    'GET /v1/groups/{groupId}/invitations': async (event) => {
      const { groupId } = await requireAdmin(event);
      const items = await store.listInvitations(groupId, now().toISOString());
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
      const { groupId } = await requireAdmin(event);
      const id = invitationIdSchema.safeParse(event.pathParameters?.invitationId);
      if (!id.success || !(await store.revokeInvitation(groupId, id.data))) {
        throw new ApiError('NOT_FOUND');
      }
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
      const membership = await store.getMembership(result.groupId, userId);
      if (!membership) throw new ApiError('NOT_FOUND');
      return { status: 200, body: summary(membership) };
    },

    'POST /v1/groups/{groupId}/leave': async (event) => {
      const { groupId, userId } = await requireMember(event);
      const result = await store.removeMember(groupId, userId, userId);
      // The last admin must transfer ownership or dissolve the group first (§3).
      if (result === 'last_admin') throw new ApiError('CONFLICT');
      if (result === 'not_member') throw new ApiError('NOT_FOUND');
      return { status: 204, body: undefined };
    },

    'DELETE /v1/groups/{groupId}/members/{userId}': async (event) => {
      const { groupId, userId } = await requireAdmin(event);
      const target = userIdSchema.safeParse(event.pathParameters?.userId);
      if (!target.success) throw new ApiError('NOT_FOUND');
      // Admins leave through /leave, which applies the last-admin rule.
      if (target.data === userId) throw new ApiError('CONFLICT');
      const result = await store.removeMember(groupId, target.data, userId);
      if (result === 'not_member') throw new ApiError('NOT_FOUND');
      if (result !== 'removed') throw new ApiError('FORBIDDEN');
      return { status: 204, body: undefined };
    },
  };
}

/** Dispatch on API Gateway's route key; unknown routes are 404. */
export function createRouter(routes: Record<string, Route>): Route {
  return (event, context) => {
    const route = routes[event.routeKey];
    if (!route) return Promise.reject(new ApiError('NOT_FOUND'));
    return route(event, context);
  };
}
