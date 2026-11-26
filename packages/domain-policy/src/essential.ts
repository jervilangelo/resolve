/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { coveredBy } from './normalize';

/**
 * Platform essential-service registry (docs/MASTER_PLAN.md §4.1): these are never blocked by group
 * rules. A starter policy, not a claim that every host a service needs is listed.
 *
 * Group blocks apply to page and frame navigations only, never to subresources, so the scripts,
 * images and APIs these services load from other hosts (CDNs, identity endpoints) keep working
 * even if a group blocks the domain those requests go to.
 *
 * Bump ESSENTIAL_VERSION whenever the list changes: rule snapshots carry it so clients re-sync.
 */
export const ESSENTIAL_VERSION = '2026-11-25.2';

export interface EssentialEntry {
  domain: string;
  service: string;
}

export const ESSENTIAL_DOMAINS: readonly EssentialEntry[] = [
  { domain: 'facebook.com', service: 'Facebook' },
  { domain: 'fb.com', service: 'Facebook' },
  { domain: 'messenger.com', service: 'Messenger' },
  { domain: 'youtube.com', service: 'YouTube' },
  { domain: 'youtu.be', service: 'YouTube' },
  { domain: 'gmail.com', service: 'Gmail' },
  { domain: 'mail.google.com', service: 'Gmail' },
  { domain: 'outlook.com', service: 'Outlook' },
  { domain: 'outlook.live.com', service: 'Outlook' },
  { domain: 'outlook.office.com', service: 'Outlook' },
  { domain: 'accounts.google.com', service: 'Google account' },
  { domain: 'drive.google.com', service: 'Google Drive' },
  { domain: 'meet.google.com', service: 'Google Meet' },
  { domain: 'office.com', service: 'Microsoft 365' },
  { domain: 'microsoft365.com', service: 'Microsoft 365' },
  { domain: 'teams.microsoft.com', service: 'Microsoft Teams' },
  { domain: 'teams.live.com', service: 'Microsoft Teams' },
  // Microsoft 365's current unified domain (https://learn.microsoft.com/microsoft-365/enterprise/).
  { domain: 'teams.cloud.microsoft', service: 'Microsoft Teams' },
  { domain: 'outlook.cloud.microsoft', service: 'Outlook' },
  { domain: 'm365.cloud.microsoft', service: 'Microsoft 365' },
  { domain: 'login.microsoftonline.com', service: 'Microsoft sign-in' },
];

/** The essential entry protecting `host`, if any (host equals it or is a subdomain of it). */
export function essentialFor(host: string): EssentialEntry | undefined {
  return ESSENTIAL_DOMAINS.find((entry) => coveredBy(host, entry.domain));
}

/** Essential entries that a block on `domain` would otherwise cover (e.g. google.com). */
export function essentialsUnder(domain: string): EssentialEntry[] {
  return ESSENTIAL_DOMAINS.filter((entry) => coveredBy(entry.domain, domain));
}
