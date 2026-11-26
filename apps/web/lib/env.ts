/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { parseEnv } from '@resolve/contracts';
import { z } from 'zod';

/** Public (build-time inlined) configuration. Never put secrets in NEXT_PUBLIC_* variables. */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  /** Comma-separated Resolve extension IDs the setup checklist may ask (public values). */
  NEXT_PUBLIC_EXTENSION_IDS: z.string().optional(),
});

export const publicEnv = parseEnv('web', publicEnvSchema, {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_EXTENSION_IDS: process.env.NEXT_PUBLIC_EXTENSION_IDS,
});
