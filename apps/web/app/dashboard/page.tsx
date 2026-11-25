/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { accountabilityViewSchema, groupListSchema } from '@resolve/contracts';
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';
import { getProfile } from '@/lib/profile';
import { type HomeGroup, HomeScreen } from './home';

export const metadata: Metadata = { title: 'Home' };

/** Sharing details are read for this many groups at most (the home shows the first few). */
const SHARING_LOOKUPS = 10;

export default async function DashboardHome() {
  const [profile, groups] = await Promise.all([
    getProfile(),
    api('/v1/groups?limit=100', groupListSchema),
  ]);

  const homeGroups: HomeGroup[] = await Promise.all(
    groups.items.map(async (group, index): Promise<HomeGroup> => {
      const base = { groupId: group.groupId, name: group.name, role: group.role };
      if (index >= SHARING_LOOKUPS) return { ...base, sharing: null };
      try {
        const view = await api(
          `/v1/groups/${group.groupId}/accountability`,
          accountabilityViewSchema,
        );
        return {
          ...base,
          sharing: {
            mode: view.sharing.mode,
            receiving: view.recipients.filter((r) => r.status === 'receiving').length,
          },
        };
      } catch (error) {
        unstable_rethrow(error);
        return { ...base, sharing: null }; // shown as "—"; the rest of the home still loads
      }
    }),
  );

  return <HomeScreen name={profile.displayName ?? ''} groups={homeGroups} />;
}
