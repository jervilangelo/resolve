/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { randomBytes } from 'node:crypto';
import {
  type GroupList,
  type GroupSummary,
  type HealthResponse,
  type Profile,
  createGroupRequestSchema,
  groupIdSchema,
  idempotencyKeySchema,
  pageQuerySchema,
  updateProfileRequestSchema,
} from '@resolve/contracts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
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

/** `grp_` + 26 random base32 characters (130 bits). */
export function generateGroupId(): string {
  return `grp_${Array.from(randomBytes(26), (byte) => BASE32[byte % 32] ?? 'a').join('')}`;
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
