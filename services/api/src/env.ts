/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { parseEnv, stageSchema } from '@resolve/contracts';
import { z } from 'zod';

/**
 * Lambda configuration, injected by Terraform. Secrets are never passed as plain variables:
 * add their SSM/Secrets Manager *names* here and resolve them at runtime.
 */
export const apiEnvSchema = z.object({
  STAGE: stageSchema,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

let cached: ApiEnv | undefined;

/** Parsed once per cold start; throws EnvValidationError (no values) on misconfiguration. */
export function getEnv(source: Record<string, string | undefined> = process.env): ApiEnv {
  cached ??= parseEnv('api', apiEnvSchema, source);
  return cached;
}
