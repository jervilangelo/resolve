/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';
import { groupIdSchema } from './api';

/**
 * Installation alerts (docs/MASTER_PLAN.md §7.4): a browser enrolled by its owner reports, through
 * an uninstall URL, that Resolve was removed, and checks in periodically so that a long silence can
 * be reported. Both are opt-in for the sender (per alert type, per group) and for each recipient
 * (per alert type, on top of their usual consent). Nothing about browsing is involved.
 */

/** The two installation alert types. */
export const installAlertTypeSchema = z.enum(['removal', 'inactivity']);
export type InstallAlertType = z.infer<typeof installAlertTypeSchema>;

/** How often an enrolled extension checks in (an alarm; also at browser start). */
export const CHECK_IN_INTERVAL_MINUTES = 60;
/**
 * Silence that counts as "no longer checking in". Generous on purpose: browsers are closed
 * overnight and over weekends, computers sleep and go offline. One alert per silent period.
 */
export const INACTIVITY_GRACE_HOURS = 72;
/** How often the backend looks for installations past the grace period. */
export const INACTIVITY_SCAN_INTERVAL_MINUTES = 60;

export const installationIdSchema = z.string().regex(/^ins_[a-z2-7]{26}$/);
/** 32 random bytes, base64url: the secret behind the uninstall URL (stored only as a hash). */
export const installationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/**
 * The extension enrols this browser for its active group. Since 0.5.1 the extension chooses the
 * installation ID and token itself and stores them before sending, so a lost response can be
 * retried with the same values instead of leaving an unknown enrolment behind (0.5.0 sends only
 * the group, and the server generates both).
 */
export const createInstallationRequestSchema = z.union([
  z.strictObject({
    groupId: groupIdSchema,
    installationId: installationIdSchema,
    token: installationTokenSchema,
  }),
  z.strictObject({ groupId: groupIdSchema }),
]);
export const createdInstallationSchema = z.strictObject({
  installationId: installationIdSchema,
  token: installationTokenSchema,
});
export type CreatedInstallation = z.infer<typeof createdInstallationSchema>;

/** The uninstall-URL callback, relayed by the website: the token alone identifies the browser. */
export const installationRemovedRequestSchema = z.strictObject({
  token: installationTokenSchema,
});

/** A member's own installation-alert choices in one group (all off by default). */
export const alertTypePrefsSchema = z.strictObject({
  /** Share this alert type with the members you share with. */
  share: z.strictObject({ removal: z.boolean(), inactivity: z.boolean() }),
  /** Receive this alert type from members whose alerts you agreed to receive. */
  receive: z.strictObject({ removal: z.boolean(), inactivity: z.boolean() }),
});
export type AlertTypePrefs = z.infer<typeof alertTypePrefsSchema>;

export const NO_ALERT_TYPES: AlertTypePrefs = {
  share: { removal: false, inactivity: false },
  receive: { removal: false, inactivity: false },
};

/** Change any of one's own choices; unspecified ones stay as they are. */
export const updateAlertTypesRequestSchema = z
  .strictObject({
    share: z.strictObject({ removal: z.boolean(), inactivity: z.boolean() }).partial(),
    receive: z.strictObject({ removal: z.boolean(), inactivity: z.boolean() }).partial(),
  })
  .partial();
export type UpdateAlertTypesRequest = z.infer<typeof updateAlertTypesRequestSchema>;

/** Formats an alert time for an email, in UTC (the recipient's time zone is not known). */
export function formatAlertTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
  return `${day}, ${time} UTC`;
}
