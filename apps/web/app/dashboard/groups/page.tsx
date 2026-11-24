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
import { api } from '@/lib/api';
import { CreateGroupForm } from '../forms';

export const metadata: Metadata = { title: 'Groups' };

export default async function GroupsPage() {
  const groups = await api('/v1/groups?limit=100', groupListSchema);
  return (
    <div className="space-y-10">
      <section aria-labelledby="your-groups">
        <h1 id="your-groups" className="font-display text-2xl">
          Your groups
        </h1>
        {groups.items.length === 0 ? (
          <p className="text-muted-foreground mt-4">
            You are not in any group yet. Create one below, or ask a group admin for an invitation.
          </p>
        ) : (
          <ul className="mt-6 divide-y rounded-lg border">
            {groups.items.map((group) => (
              <li key={group.groupId}>
                <Link
                  href={`/dashboard/groups/${group.groupId}`}
                  className="hover:bg-muted flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="font-medium">{group.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {group.role === 'ADMIN' ? 'Admin' : 'Member'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="create-group" className="space-y-4">
        <h2 id="create-group" className="font-semibold">
          Create a group
        </h2>
        <CreateGroupForm idempotencyKey={randomBytes(18).toString('base64url')} />
      </section>
    </div>
  );
}
