/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { groupIdSchema, groupSummarySchema } from '@resolve/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiRequestError, api } from '@/lib/api';

export const metadata: Metadata = { title: 'Group' };

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!groupIdSchema.safeParse(groupId).success) notFound();

  let group;
  try {
    group = await api(`/v1/groups/${groupId}`, groupSummarySchema);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/groups" className="text-muted-foreground text-sm hover:underline">
        ← All groups
      </Link>
      <h1 className="font-display text-2xl">{group.name}</h1>
      <dl className="grid max-w-sm grid-cols-2 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Your role</dt>
        <dd>{group.role === 'ADMIN' ? 'Admin' : 'Member'}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>
          <time dateTime={group.createdAt}>
            {new Date(group.createdAt).toLocaleDateString('en', { dateStyle: 'long' })}
          </time>
        </dd>
      </dl>
      <p className="text-muted-foreground text-sm">
        Invitations and member management are coming next.
      </p>
    </div>
  );
}
