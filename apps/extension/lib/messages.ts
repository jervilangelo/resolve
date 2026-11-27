/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { groupIdSchema, groupRoleSchema } from '@resolve/contracts';
import { z } from 'zod';
import { focusMinutesSchema, focusSessionSchema, focusSettingsSchema } from './focus';
import { filterSettingsSchema } from './media/protocol';

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
  z.strictObject({ type: z.literal('filter/get') }),
  z.strictObject({ type: z.literal('alerts/get') }),
  z.strictObject({ type: z.literal('installAlerts/get') }),
  z.strictObject({ type: z.literal('installAlerts/set'), on: z.boolean() }),
  z.strictObject({ type: z.literal('filter/set'), settings: filterSettingsSchema }),
  z.strictObject({ type: z.literal('focus/get') }),
  z.strictObject({
    type: z.literal('focus/start'),
    minutes: focusMinutesSchema,
    optional: focusSettingsSchema.shape.optional,
  }),
  z.strictObject({ type: z.literal('focus/end') }),
  z.strictObject({
    type: z.literal('focus/configure'),
    minutes: focusMinutesSchema,
    optional: focusSettingsSchema.shape.optional,
  }),
]);
export type Request = z.infer<typeof requestSchema>;

/**
 * The one question the Resolve dashboard may ask (from its own origin only, via
 * externally_connectable), for its checklist and "This browser" status: whether this browser
 * is signed in, which of the user's groups it protects for, and the state of each protection.
 * Nothing about browsing.
 */
export const dashboardRequestSchema = z.strictObject({ type: z.literal('dashboard/status') });
export const dashboardStatusSchema = z.strictObject({
  signedIn: z.boolean(),
  mediaBlur: z.boolean(),
  version: z.string(),
  activeGroupId: z.string().nullable(),
  protection: z.enum(['off', 'starting', 'idle', 'on', 'stale', 'error']),
  syncedAt: z.number().nullable(),
  media: z.enum(['off', 'on', 'needsAccess', 'unsupported']),
  alerts: z.enum(['on', 'off', 'inactive', 'unsupported']),
});
export type DashboardStatus = z.infer<typeof dashboardStatusSchema>;

/** True only for the configured dashboard's exact origin. */
export function isDashboardOrigin(
  senderOrigin: string | undefined,
  dashboardUrl: string | undefined,
) {
  if (!senderOrigin || !dashboardUrl) return false;
  try {
    return new URL(dashboardUrl).origin === senderOrigin;
  } catch {
    return false;
  }
}

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
    /** Domain protection for the active group (see ProtectionStatus in lib/protection.ts). */
    protection: z.strictObject({
      state: z.enum(['off', 'starting', 'idle', 'on', 'stale', 'error']),
      syncedAt: z.number().nullable(),
    }),
    /**
     * The user's own accountability sharing in the active group (null: no group, or offline):
     * the mode and how many chosen members agreed to receive alerts.
     */
    sharing: z
      .strictObject({
        mode: z.enum(['PRIVATE', 'SELECTED', 'EVERYONE']),
        receiving: z.number().int().min(0),
      })
      .nullable(),
    dashboardUrl: z.url(),
    error: z.string().optional(),
  }),
]);
export type AccountState = z.infer<typeof accountStateSchema>;

/** The on-device media filter as the options page and popup show it. */
export const filterStateSchema = z.strictObject({
  settings: filterSettingsSchema,
  status: z.enum(['off', 'on', 'needsAccess', 'unsupported']),
});
export type FilterStateMessage = z.infer<typeof filterStateSchema>;

/** Blocked-visit alerts: `on` only when a report could actually be sent right now. */
export const alertsStatusSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('on') }),
  z.strictObject({ state: z.literal('off') }),
  z.strictObject({ state: z.literal('unsupported') }),
  z.strictObject({
    state: z.literal('inactive'),
    reason: z.enum(['signedOut', 'noGroup', 'noRestrictions']),
  }),
]);
export type AlertsStatus = z.infer<typeof alertsStatusSchema>;

/** Installation alerts (removal and inactivity): `on` once this browser is enrolled. */
export const installAlertsStatusSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('off') }),
  z.strictObject({ state: z.literal('on'), lastCheckInAt: z.number().nullable() }),
  z.strictObject({
    state: z.literal('inactive'),
    reason: z.enum(['signedOut', 'noGroup', 'offline']),
  }),
]);
export type InstallAlertsStatusMessage = z.infer<typeof installAlertsStatusSchema>;

/** Focus Mode as the popup and options page show it: the settings and what is enforced. */
export const focusStateSchema = z.strictObject({
  settings: focusSettingsSchema,
  session: focusSessionSchema.nullable(),
  enforcement: z.enum(['on', 'off', 'error']),
  focusPage: z.boolean(),
  supported: z.boolean(),
});

export interface ResponseMap {
  'status/get': Status;
  'account/get': AccountState;
  'account/signIn': AccountState;
  'account/signOut': AccountState;
  'protection/retry': AccountState;
  'group/setActive': AccountState;
  'filter/get': FilterStateMessage;
  'alerts/get': AlertsStatus;
  'installAlerts/get': InstallAlertsStatusMessage;
  'installAlerts/set': InstallAlertsStatusMessage;
  'filter/set': FilterStateMessage;
  'focus/get': z.infer<typeof focusStateSchema>;
  'focus/start': z.infer<typeof focusStateSchema>;
  'focus/end': z.infer<typeof focusStateSchema>;
  'focus/configure': z.infer<typeof focusStateSchema>;
}

export const responseSchemas = {
  'status/get': statusSchema,
  'account/get': accountStateSchema,
  'account/signIn': accountStateSchema,
  'account/signOut': accountStateSchema,
  'protection/retry': accountStateSchema,
  'group/setActive': accountStateSchema,
  'filter/get': filterStateSchema,
  'alerts/get': alertsStatusSchema,
  'installAlerts/get': installAlertsStatusSchema,
  'installAlerts/set': installAlertsStatusSchema,
  'filter/set': filterStateSchema,
  'focus/get': focusStateSchema,
  'focus/start': focusStateSchema,
  'focus/end': focusStateSchema,
  'focus/configure': focusStateSchema,
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
