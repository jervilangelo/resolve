/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { type GroupList, groupListSchema, groupSummarySchema } from '@resolve/contracts';
import type { z } from 'zod';
import { type Auth, TransientAuthError } from './auth';
import type { ExtensionConfig } from './config';
import type { AccountState, GroupOption } from './messages';

/** Upper bound on pages read for the picker (100 groups each). */
const MAX_GROUP_PAGES = 50;
const OFFLINE = 'Could not reach Resolve. Check your connection and try again.';
const REVOCATION_NOTICE =
  'Signed out on this device. Access will be fully revoked once Resolve can be reached.';

export interface AccountPlatform {
  fetch: typeof fetch;
}

class SignedOutError extends Error {}

/** Account state and the per-installation active group, backed by the Resolve API. */
export function createAccount(config: ExtensionConfig, auth: Auth, platform: AccountPlatform) {
  /** GET from the API; null for 404. Throws SignedOutError or TransientAuthError. */
  async function api<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T> | null> {
    const access = await auth.accessToken();
    if (!access) throw new SignedOutError();
    let res: Response;
    try {
      res = await platform.fetch(new URL(path, config.apiUrl), {
        headers: { authorization: `Bearer ${access.token}` },
      });
    } catch {
      throw new TransientAuthError();
    }
    if (res.status === 401) {
      // Only end the sign-in this token belonged to, never a newer one.
      await auth.signOut(access.sid);
      throw new SignedOutError();
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new TransientAuthError();
    return schema.parse(await res.json());
  }

  async function allGroups(): Promise<GroupOption[]> {
    const groups: GroupOption[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_GROUP_PAGES; page++) {
      const query: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const list: GroupList | null = await api(`/v1/groups?limit=100${query}`, groupListSchema);
      if (!list) break;
      groups.push(...list.items.map(({ groupId, name, role }) => ({ groupId, name, role })));
      cursor = list.nextCursor;
      if (!cursor) break;
    }
    return groups;
  }

  async function state(notice?: string): Promise<AccountState> {
    await auth.flushRevocations();
    const session = await auth.session();
    if (!session) {
      const error = notice ?? ((await auth.revocationPending()) ? REVOCATION_NOTICE : undefined);
      return { state: 'signedOut', ...(error && { error }) };
    }
    const base = {
      state: 'signedIn' as const,
      email: session.email,
      dashboardUrl: config.dashboardUrl,
    };
    let active = session.activeGroupId ?? null;
    try {
      const groups = await allGroups();
      // The group list is eventually consistent; confirm with the group itself before clearing a
      // selection after leaving, removal or dissolution.
      if (active && !groups.some((g) => g.groupId === active)) {
        const group = await api(`/v1/groups/${active}`, groupSummarySchema);
        if (group) groups.push({ groupId: group.groupId, name: group.name, role: group.role });
        else {
          await auth.setActiveGroup(session.sid, null);
          active = null;
        }
      }
      return {
        ...base,
        groups,
        groupsLoaded: true,
        activeGroupId: active,
        ...(notice && { error: notice }),
      };
    } catch (caught) {
      if (caught instanceof SignedOutError) return { state: 'signedOut' };
      return { ...base, groups: [], groupsLoaded: false, activeGroupId: active, error: OFFLINE };
    }
  }

  return {
    state,

    async signIn(): Promise<AccountState> {
      try {
        await auth.signIn();
        return await state();
      } catch {
        return state('Sign-in did not complete.');
      }
    },

    async signOut(): Promise<AccountState> {
      await auth.signOut();
      return state();
    },

    async setActiveGroup(groupId: string | null): Promise<AccountState> {
      const session = await auth.session();
      if (!session) return state();
      if (groupId === null) {
        await auth.setActiveGroup(session.sid, null);
        return state();
      }
      try {
        // Strongly consistent membership check before protecting for this group.
        const group = await api(`/v1/groups/${groupId}`, groupSummarySchema);
        if (!group) return await state('That group is no longer available.');
        // Applied only if the same sign-in is still current.
        await auth.setActiveGroup(session.sid, group.groupId);
        return await state();
      } catch (caught) {
        if (caught instanceof SignedOutError) return { state: 'signedOut' };
        return state('Could not change the active group. Try again.');
      }
    },
  };
}
