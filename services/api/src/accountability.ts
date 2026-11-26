/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  type AccountabilityView,
  NO_CONSENT,
  PRIVATE_SHARING,
  consentsTo,
  sharesWith,
} from '@resolve/contracts';
import type { StoredConsent, StoredMember, StoredSharing } from './store/store';

/**
 * Accountability policy (docs/MASTER_PLAN.md §6). Pure functions over the current members and the
 * stored choices, so every rule is decided in one place and tested on its own.
 *
 * Retroactivity: a choice only counts for the membership it was made in (see sharesWith and
 * consentsTo in @resolve/contracts): rejoining starts from nothing, in both directions.
 */
export { NO_CONSENT, PRIVATE_SHARING };
export interface AccountabilityState {
  sharing: ReadonlyMap<string, StoredSharing>;
  consents: ReadonlyMap<string, StoredConsent>;
}

const shares = sharesWith;
const consents = consentsTo;

/**
 * The members who receive `senderId`'s alerts right now: current members (never the sender) whom
 * the sender's own policy includes and who themselves agreed. Admins have no say in either.
 */
export function eligibleRecipients(
  senderId: string,
  members: readonly StoredMember[],
  state: AccountabilityState,
): string[] {
  const sender = members.find((m) => m.userId === senderId);
  if (!sender) return [];
  const sharing = state.sharing.get(senderId) ?? PRIVATE_SHARING;
  if (sharing.mode === 'PRIVATE') return [];
  return members
    .filter((m) => m.userId !== senderId)
    .filter((m) => shares(sharing, m))
    .filter((m) => consents(state.consents.get(m.userId) ?? NO_CONSENT, sender))
    .map((m) => m.userId);
}

/** What `userId` may see: their own choices and only the relationships that involve them. */
export function accountabilityView(
  userId: string,
  members: readonly StoredMember[],
  state: AccountabilityState,
): AccountabilityView {
  const me = members.find((m) => m.userId === userId);
  const sharing = state.sharing.get(userId) ?? PRIVATE_SHARING;
  const consent = state.consents.get(userId) ?? NO_CONSENT;
  const others = members.filter((m) => m.userId !== userId);
  const person = (m: StoredMember) => ({ userId: m.userId, displayName: m.displayName });

  const recipients = me
    ? others
        .filter((m) => shares(sharing, m))
        .map((m) => ({
          ...person(m),
          status: consents(state.consents.get(m.userId) ?? NO_CONSENT, me)
            ? ('receiving' as const)
            : ('awaiting' as const),
        }))
    : [];
  const senders = me
    ? others
        .filter((m) => shares(state.sharing.get(m.userId) ?? PRIVATE_SHARING, me))
        .map((m) => ({
          ...person(m),
          status: consents(consent, m) ? ('receiving' as const) : ('needs_consent' as const),
        }))
    : [];

  return {
    sharing: {
      mode: sharing.mode,
      // Only selections that still count (current members, made in their current membership).
      recipientIds:
        sharing.mode === 'SELECTED'
          ? others.filter((m) => shares(sharing, m)).map((m) => m.userId)
          : [],
      updatedAt: sharing.updatedAt,
    },
    receiving: { acceptAll: consent.acceptAll },
    recipients,
    senders,
  };
}
