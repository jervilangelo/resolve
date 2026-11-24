/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';

declare const __RESOLVE_SETTINGS__: Record<string, string>;

const https = z.url().refine((value) => value.startsWith('https://'), 'Must be HTTPS');

/** Build-time settings (RESOLVE_* in .env files, see scripts/extension-env.mjs). */
const configSchema = z.object({
  RESOLVE_API_URL: https,
  RESOLVE_COGNITO_DOMAIN: https,
  RESOLVE_COGNITO_CLIENT_ID: z.string().min(1),
  RESOLVE_DASHBOARD_URL: z.url(),
});

export interface ExtensionConfig {
  apiUrl: string;
  cognitoDomain: string;
  clientId: string;
  dashboardUrl: string;
}

/** Null when the build has no (or invalid) configuration; sign-in is then unavailable. */
export function parseConfig(settings: Record<string, unknown>): ExtensionConfig | null {
  const result = configSchema.safeParse(settings);
  if (!result.success) return null;
  return {
    apiUrl: result.data.RESOLVE_API_URL,
    cognitoDomain: result.data.RESOLVE_COGNITO_DOMAIN,
    clientId: result.data.RESOLVE_COGNITO_CLIENT_ID,
    dashboardUrl: result.data.RESOLVE_DASHBOARD_URL,
  };
}

// Firefox sign-in stays off until a Gecko ID and its identity callback are registered (owner
// decision: Firefox on hold).
export const config = import.meta.env.FIREFOX ? null : parseConfig(__RESOLVE_SETTINGS__);
