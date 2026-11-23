/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';

export const stageSchema = z.enum(['dev', 'prod', 'test']);
export type Stage = z.infer<typeof stageSchema>;

export const healthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('resolve-api'),
  stage: stageSchema,
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
