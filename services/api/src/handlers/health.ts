/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { HealthResponse } from '@resolve/contracts';
import { getEnv } from '../env';
import { createHandler } from '../http';

/** GET /v1/health — unauthenticated liveness probe; reveals nothing beyond the stage. */
export const handler = createHandler('GET /v1/health', () => {
  const body: HealthResponse = { status: 'ok', service: 'resolve-api', stage: getEnv().STAGE };
  return Promise.resolve({ status: 200, body });
});
