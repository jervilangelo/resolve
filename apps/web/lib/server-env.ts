/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import 'server-only';
import { parseEnv } from '@resolve/contracts';
import { z } from 'zod';

/** Server-only configuration (never NEXT_PUBLIC_*). Generate locally with `pnpm web:env dev`. */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  RESOLVE_API_URL: z.url(),
  COGNITO_DOMAIN: z.url(),
  COGNITO_CLIENT_ID: z.string().min(1),
  /** Encrypts session cookies. At least 32 random characters. */
  SESSION_SECRET: z.string().min(32),
});
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseEnv('web', serverEnvSchema, {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    RESOLVE_API_URL: process.env.RESOLVE_API_URL,
    COGNITO_DOMAIN: process.env.COGNITO_DOMAIN,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
    SESSION_SECRET: process.env.SESSION_SECRET,
  });
  return cached;
}
