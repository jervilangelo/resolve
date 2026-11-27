/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { randomBytes } from 'node:crypto';
import { INACTIVITY_GRACE_HOURS, MAX_GROUP_MEMBERS, type OutboxItem } from '@resolve/contracts';
import { eligibleInstallRecipients } from './accountability';
import type { DueInstallation, Store, StoredInstallation, StoredMember } from './store/store';

/**
 * Installation alerts (docs/MASTER_PLAN.md §7.4). An enrolled browser has an uninstall-URL token
 * (stored only as a hash) and checks in periodically. Removal and a silence longer than the grace
 * period each produce one outbox item for the recipients who agreed to that alert type; the
 * delivery worker re-checks everything before sending.
 */

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
const randomId = (prefix: string) =>
  `${prefix}_${Array.from(randomBytes(26), (byte) => BASE32[byte % 32] ?? 'a').join('')}`;

export const newInstallationId = () => randomId('ins');
/** 256 random bits, base64url (43 characters). */
export const newInstallationToken = () => randomBytes(32).toString('base64url');

/** When an installation that just checked in at `at` counts as silent. */
export function silenceDeadline(at: Date): string {
  return new Date(at.getTime() + INACTIVITY_GRACE_HOURS * 60 * 60 * 1000).toISOString();
}

async function allMembers(store: Store, groupId: string): Promise<StoredMember[]> {
  const members: StoredMember[] = [];
  let cursor: string | undefined;
  do {
    const page = await store.listMembers(groupId, MAX_GROUP_MEMBERS, cursor);
    members.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return members;
}

/**
 * The outbox item for an installation alert, or undefined when nobody may receive it (the sender
 * left the group, shares nothing of this type, or no partner agreed to it).
 */
export async function installationOutbox(
  store: Store,
  installation: StoredInstallation,
  kind: 'EXTENSION_REMOVED' | 'EXTENSION_INACTIVE',
  occurredAt: string,
  now: Date,
): Promise<OutboxItem | undefined> {
  const [group, members, state] = await Promise.all([
    store.getGroup(installation.groupId),
    allMembers(store, installation.groupId),
    store.getAccountability(installation.groupId),
  ]);
  const sender = members.find((m) => m.userId === installation.userId);
  if (!group || !sender) return undefined;
  const type = kind === 'EXTENSION_REMOVED' ? 'removal' : 'inactivity';
  const recipientIds = eligibleInstallRecipients(installation.userId, type, members, state);
  if (recipientIds.length === 0) return undefined;
  return {
    outboxId: randomId('out'),
    kind,
    groupId: installation.groupId,
    groupName: group.name,
    senderId: installation.userId,
    senderName: sender.displayName,
    senderJoinedAt: sender.joinedAt,
    recipientIds,
    occurredAt,
    createdAt: now.toISOString(),
  };
}

/** Installations handled per scan; the rest wait for the next run. */
export const SCAN_BATCH = 100;

export interface ScanResult {
  due: number;
  alerted: number;
  silent: number;
  changed: number;
  failed: number;
}

/**
 * The scheduled inactivity check: every enrolled browser whose check-ins stopped for longer than
 * the grace period gets one alert per silent period (none if nobody may receive it). A check-in or
 * removal racing the scan wins.
 */
export async function scanInactiveInstallations(
  store: Store,
  now: Date,
  /** Milliseconds left for this run; batches continue until the budget or the backlog runs out. */
  budgetMs = 40_000,
  clock: () => number = Date.now,
): Promise<ScanResult> {
  const result: ScanResult = { due: 0, alerted: 0, silent: 0, changed: 0, failed: 0 };
  const deadline = clock() + budgetMs;
  // Installations that failed in this run stay due for the next one, but are not retried here.
  const failed = new Set<string>();
  while (clock() < deadline) {
    const batch: DueInstallation[] = (
      await store.listDueInstallations(now.toISOString(), SCAN_BATCH + failed.size)
    ).filter((i) => !failed.has(`${i.userId}#${i.installationId}`));
    if (batch.length === 0) break;
    for (const installation of batch) {
      if (clock() >= deadline) break;
      result.due += 1;
      try {
        const outbox = await installationOutbox(
          store,
          installation,
          'EXTENSION_INACTIVE',
          installation.lastCheckInAt,
          now,
        );
        const marked = await store.markInstallationInactive(
          installation,
          now.toISOString(),
          outbox,
        );
        if (marked === 'changed') result.changed += 1;
        else if (outbox) result.alerted += 1;
        else result.silent += 1;
      } catch {
        // One installation (a transaction conflict, a malformed row) never holds up the rest.
        failed.add(`${installation.userId}#${installation.installationId}`);
        result.failed += 1;
      }
    }
    if (batch.length < SCAN_BATCH) break;
  }
  return result;
}
