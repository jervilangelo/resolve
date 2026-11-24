/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  type GroupSummary,
  domainAuditListSchema,
  groupDomainListSchema,
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
  BlockDomainForm,
  DissolveGroupPanel,
  DomainActions,
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
  const [me, members, invitations, domains, audit] = await Promise.all([
    api('/v1/me', profileSchema),
    api(`/v1/groups/${groupId}/members?limit=100`, memberListSchema),
    isAdmin ? api(`/v1/groups/${groupId}/invitations`, invitationListSchema) : null,
    isAdmin ? api(`/v1/groups/${groupId}/domains`, groupDomainListSchema) : null,
    isAdmin ? api(`/v1/groups/${groupId}/domains/audit`, domainAuditListSchema) : null,
  ]);
  const memberName = (userId: string) =>
    members.items.find((m) => m.userId === userId)?.displayName ??
    (userId === me.userId ? 'You' : 'A former member');
  const category = (type?: string) => (type === 'NON_NEGOTIABLE' ? 'non-negotiable' : 'additional');
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
            const self = member.userId === me.userId;
            const name = member.displayName ?? (self ? 'You' : 'Unnamed member');
            return (
              <li key={member.userId} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {name}
                    {self && member.displayName && (
                      <span className="text-muted-foreground font-normal"> (you)</span>
                    )}
                  </p>
                  {self && !member.displayName && (
                    <Link href="/dashboard/profile" className="text-xs underline">
                      Add a display name so members can recognise you
                    </Link>
                  )}
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

      <section aria-labelledby="blocked" className="space-y-4">
        <div className="space-y-1">
          <h2 id="blocked" className="font-semibold">
            Blocked websites
          </h2>
          <p className="text-muted-foreground text-sm">
            {isAdmin
              ? 'Non-negotiable websites are blocked and can lead to an accountability alert (once sharing is set up). Additional websites are blocked without alerts. Members can add additional websites; only admins can see or change this list.'
              : 'Add a website to block for everyone in this group. It takes effect immediately. The full list is visible to admins only.'}
          </p>
        </div>
        <BlockDomainForm groupId={groupId} isAdmin={isAdmin} />
        {domains && domains.items.length > 0 && (
          <ul className="bg-card divide-y rounded-lg border text-sm">
            {domains.items.map((entry) => (
              <li
                key={entry.domain}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{entry.domain}</p>
                  <p className="text-muted-foreground text-xs">
                    {entry.type === 'NON_NEGOTIABLE' ? 'Non-negotiable' : 'Additional'} · added{' '}
                    {new Date(entry.createdAt).toLocaleDateString('en', dateFormat)}
                  </p>
                </div>
                <DomainActions groupId={groupId} domain={entry.domain} type={entry.type} />
              </li>
            ))}
          </ul>
        )}
        {audit && audit.items.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Recent changes</summary>
            <ul className="mt-2 space-y-1">
              {audit.items.map((entry) => (
                <li
                  key={`${entry.at}-${entry.domain}-${entry.action}`}
                  className="text-muted-foreground"
                >
                  {new Date(entry.at).toLocaleString('en', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  · {memberName(entry.actorId)}{' '}
                  {entry.action === 'ADDED'
                    ? `added ${entry.domain} (${category(entry.to)})`
                    : entry.action === 'REMOVED'
                      ? `removed ${entry.domain}`
                      : `changed ${entry.domain} to ${category(entry.to)}`}
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="text-muted-foreground text-xs">
          The list is private in the dashboard and API, but browsers must hold the rules to enforce
          them, so a technically skilled member could still inspect or infer blocked websites.
        </p>
      </section>

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
