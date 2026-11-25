/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { groupListSchema } from '@resolve/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { randomBytes } from 'node:crypto';
import { PageTitle, SettingsRow } from '@/components/settings-row';
import { api } from '@/lib/api';
import { CreateGroupForm } from '../forms';

export const metadata: Metadata = { title: 'Groups' };

const dateFormat = { day: 'numeric', month: 'short', year: 'numeric' } as const;

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string | string[] }>;
}) {
  const requested = (await searchParams).name;
  // A name typed on the landing page; trimmed and capped, and only ever a form's default value.
  const defaultName =
    typeof requested === 'string'
      ? Array.from(requested.trim()).slice(0, 60).join('') || undefined
      : undefined;
  const groups = await api('/v1/groups?limit=100', groupListSchema);
  const admins = groups.items.filter((g) => g.role === 'ADMIN').length;
  return (
    <div>
      <PageTitle
        title="Groups"
        line={
          groups.items.length === 0
            ? 'You are not in a group yet.'
            : `${String(groups.items.length)} ${groups.items.length === 1 ? 'group' : 'groups'} · admin of ${String(admins)}`
        }
      />
      <SettingsRow
        id="your-groups"
        title="Your groups"
        description="Each group has its own blocked websites and its own accountability choices. The extension protects for one group at a time."
      >
        {groups.items.length === 0 ? (
          <p className="bg-card rounded-xl border border-dashed px-4 py-3 text-sm">
            Create a group below, or open an invitation link from a group admin.
          </p>
        ) : (
          <ul className="space-y-2">
            {groups.items.map((group) => (
              <li key={group.groupId}>
                <Link
                  href={`/dashboard/groups/${group.groupId}`}
                  className="bg-card hover:border-foreground/30 flex min-h-[63px] items-center justify-between gap-4 rounded-xl border px-4 py-2.5 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{group.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      Created {new Date(group.createdAt).toLocaleDateString('en', dateFormat)}
                    </span>
                  </span>
                  <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {group.role === 'ADMIN' ? 'Admin' : 'Member'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SettingsRow>
      <SettingsRow
        id="create-group"
        title="Create a group"
        description="You become its admin: you choose its blocked websites and invite members with a link."
      >
        <CreateGroupForm
          idempotencyKey={randomBytes(18).toString('base64url')}
          defaultName={defaultName}
        />
      </SettingsRow>
    </div>
  );
}
