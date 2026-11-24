/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { groupIdSchema, groupRoleSchema } from '@resolve/contracts';
import { z } from 'zod';

/**
 * Typed runtime messages from extension pages to the background worker. Every message is
 * validated, and the worker answers only this extension's own pages (never content scripts,
 * which run alongside untrusted sites). Tokens never leave the worker.
 */
export const requestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('status/get') }),
  z.strictObject({ type: z.literal('account/get') }),
  z.strictObject({ type: z.literal('account/signIn') }),
  z.strictObject({ type: z.literal('account/signOut') }),
  z.strictObject({ type: z.literal('protection/retry') }),
  z.strictObject({ type: z.literal('group/setActive'), groupId: groupIdSchema.nullable() }),
]);
export type Request = z.infer<typeof requestSchema>;

/** Protection features and whether this build ships them. */
export const featureIdSchema = z.enum(['ai-filter', 'domain-protection', 'accountability']);
export type FeatureId = z.infer<typeof featureIdSchema>;

export const statusSchema = z.strictObject({
  version: z.string(),
  features: z.array(z.strictObject({ id: featureIdSchema, available: z.boolean() })),
});
export type Status = z.infer<typeof statusSchema>;

const groupOptionSchema = z.strictObject({
  groupId: groupIdSchema,
  name: z.string(),
  role: groupRoleSchema,
});
export type GroupOption = z.infer<typeof groupOptionSchema>;

export const accountStateSchema = z.discriminatedUnion('state', [
  /** Built without API/Cognito configuration. */
  z.strictObject({ state: z.literal('unconfigured') }),
  z.strictObject({ state: z.literal('signedOut'), error: z.string().optional() }),
  z.strictObject({
    state: z.literal('signedIn'),
    email: z.string().nullable(),
    groups: z.array(groupOptionSchema),
    /** False when the list could not be loaded (offline); the UI must not claim "no groups". */
    groupsLoaded: z.boolean(),
    /** The one group this installation protects for (MVP: one per installation). */
    activeGroupId: groupIdSchema.nullable(),
    /** Domain protection for the active group: off, on, or on with stale rules. */
    protection: z.strictObject({
      state: z.enum(['off', 'starting', 'on', 'stale', 'error']),
      syncedAt: z.number().nullable(),
    }),
    dashboardUrl: z.url(),
    error: z.string().optional(),
  }),
]);
export type AccountState = z.infer<typeof accountStateSchema>;

export interface ResponseMap {
  'status/get': Status;
  'account/get': AccountState;
  'account/signIn': AccountState;
  'account/signOut': AccountState;
  'protection/retry': AccountState;
  'group/setActive': AccountState;
}

export const responseSchemas = {
  'status/get': statusSchema,
  'account/get': accountStateSchema,
  'account/signIn': accountStateSchema,
  'account/signOut': accountStateSchema,
  'protection/retry': accountStateSchema,
  'group/setActive': accountStateSchema,
} as const;

export function parseRequest(message: unknown): Request | null {
  const result = requestSchema.safeParse(message);
  return result.success ? result.data : null;
}

/**
 * Only pages packaged in this extension (popup, options) may call the worker. `extensionBase` is
 * runtime.getURL('/'), e.g. chrome-extension://<id>/. A prefix match is used because URL origins of
 * non-web schemes are opaque ("null") in some runtimes.
 */
export function isExtensionPage(senderUrl: string | undefined, extensionBase: string): boolean {
  if (!senderUrl || !extensionBase.endsWith('/')) return false;
  return senderUrl.startsWith(extensionBase);
}
