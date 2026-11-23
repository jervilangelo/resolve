/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { z } from 'zod';
import { ApiError } from './http';

export interface Identity {
  userId: string;
}

/**
 * API Gateway's JWT authorizer has already verified the token signature, issuer, expiry and
 * client. This re-checks the claims the API depends on, so a misconfigured route or authorizer
 * fails closed: only Cognito *access* tokens from an allowed app client are accepted.
 */
const claimsSchema = z.object({
  // Cognito subjects are UUID-shaped but not RFC 9562 compliant (e.g. variant nibble 'f').
  sub: z.guid(),
  token_use: z.literal('access'),
  client_id: z.string().min(1),
});

export function requireIdentity(
  event: APIGatewayProxyEventV2,
  allowedClientIds: readonly string[],
): Identity {
  const context = event.requestContext as { authorizer?: { jwt?: { claims?: unknown } } };
  const parsed = claimsSchema.safeParse(context.authorizer?.jwt?.claims);
  if (!parsed.success || !allowedClientIds.includes(parsed.data.client_id)) {
    throw new ApiError('UNAUTHENTICATED');
  }
  return { userId: parsed.data.sub };
}
