/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  type GroupSummary,
  groupIdSchema,
  groupSummarySchema,
  invitationListSchema,
  memberListSchema,
  profileSchema,
} from '@resolve/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiRequestError, api } from '@/lib/api';
import {
  DissolveGroupPanel,
  InvitePanel,
  LeaveGroupButton,
  RemoveMemberButton,
  RenameGroupForm,
  RevokeInvitationButton,
  RoleButton,
} from './controls';

export const metadata: Metadata = { title: 'Group' };

const dateFormat = { dateStyle: 'medium' } as const;

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!groupIdSchema.safeParse(groupId).success) notFound();

  let group: GroupSummary;
  try {
    group = await api(`/v1/groups/${groupId}`, groupSummarySchema);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
  const isAdmin = group.role === 'ADMIN';
  const [me, members, invitations] = await Promise.all([
    api('/v1/me', profileSchema),
    api(`/v1/groups/${groupId}/members?limit=100`, memberListSchema),
    isAdmin ? api(`/v1/groups/${groupId}/invitations`, invitationListSchema) : null,
  ]);
  const adminCount = members.items.filter((m) => m.role === 'ADMIN').length;

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <Link href="/dashboard/groups" className="text-muted-foreground text-sm hover:underline">
          ← All groups
        </Link>
        <h1 className="font-display text-2xl">{group.name}</h1>
        <p className="text-muted-foreground text-sm">
          You are {isAdmin ? 'an admin' : 'a member'} · created{' '}
          <time dateTime={group.createdAt}>
            {new Date(group.createdAt).toLocaleDateString('en', dateFormat)}
          </time>
        </p>
      </div>

      <section aria-labelledby="members" className="space-y-4">
        <h2 id="members" className="font-semibold">
          Members ({members.items.length})
        </h2>
        <ul className="bg-card divide-y rounded-lg border">
          {members.items.map((member) => {
            const name = member.displayName ?? 'Unnamed member';
            return (
              <li key={member.userId} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-muted-foreground text-xs">
                    {member.role === 'ADMIN' ? 'Admin' : 'Member'} · joined{' '}
                    {new Date(member.joinedAt).toLocaleDateString('en', dateFormat)}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {member.role === 'MEMBER' ? (
                      <>
                        <RoleButton
                          groupId={groupId}
                          userId={member.userId}
                          name={name}
                          to="ADMIN"
                          self={false}
                        />
                        <RemoveMemberButton groupId={groupId} userId={member.userId} name={name} />
                      </>
                    ) : (
                      adminCount > 1 && (
                        <RoleButton
                          groupId={groupId}
                          userId={member.userId}
                          name={name}
                          to="MEMBER"
                          self={member.userId === me.userId}
                        />
                      )
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isAdmin && invitations && (
        <section aria-labelledby="invite" className="space-y-4">
          <h2 id="invite" className="font-semibold">
            Invite people
          </h2>
          <InvitePanel groupId={groupId} />
          {invitations.items.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-sm font-medium">Active invite links</h3>
              <ul className="bg-card divide-y rounded-lg border text-sm">
                {invitations.items.map((inv) => (
                  <li
                    key={inv.invitationId}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <span>
                      {String(inv.uses)} of {String(inv.maxUses)} used · expires{' '}
                      {new Date(inv.expiresAt).toLocaleDateString('en', dateFormat)}
                    </span>
                    <RevokeInvitationButton groupId={groupId} invitationId={inv.invitationId} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {isAdmin && (
        <section aria-labelledby="settings" className="space-y-4">
          <h2 id="settings" className="font-semibold">
            Group settings
          </h2>
          <RenameGroupForm groupId={groupId} name={group.name} />
        </section>
      )}

      <section aria-labelledby="leave" className="space-y-3 border-t pt-8">
        <h2 id="leave" className="font-semibold">
          Leave this group
        </h2>
        {isAdmin && adminCount <= 1 ? (
          <p className="text-muted-foreground text-sm">
            You are the only admin. Make another member an admin first, or dissolve the group.
          </p>
        ) : (
          <LeaveGroupButton groupId={groupId} />
        )}
      </section>

      {isAdmin && (
        <section aria-labelledby="dissolve" className="space-y-3 border-t pt-8">
          <h2 id="dissolve" className="text-destructive font-semibold">
            Dissolve group
          </h2>
          <DissolveGroupPanel groupId={groupId} name={group.name} />
        </section>
      )}
    </div>
  );
}
