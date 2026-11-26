/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  accountabilityViewSchema,
  type GroupSummary,
  domainAuditListSchema,
  groupDomainListSchema,
  groupIdSchema,
  groupSummarySchema,
  MAX_GROUP_DOMAINS,
  invitationListSchema,
  memberListSchema,
} from '@resolve/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SettingsRow } from '@/components/settings-row';
import { ApiRequestError, api } from '@/lib/api';
import { getProfile } from '@/lib/profile';
import { AccountabilityPanel } from './accountability';
import { GROUP_TABS, type GroupTab } from './tab-list';
import { GroupTabs } from './tabs';
import { BulkDomainForm } from './bulk-domains';
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

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { groupId } = await params;
  const requested = (await searchParams).tab;
  const tab: GroupTab = GROUP_TABS.find((t) => t === requested) ?? 'websites';
  if (!groupIdSchema.safeParse(groupId).success) notFound();

  let group: GroupSummary;
  try {
    group = await api(`/v1/groups/${groupId}`, groupSummarySchema);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
  const isAdmin = group.role === 'ADMIN';
  const [me, members, accountability, invitations, domains, audit] = await Promise.all([
    getProfile(),
    api(`/v1/groups/${groupId}/members?limit=100`, memberListSchema),
    tab === 'accountability'
      ? api(`/v1/groups/${groupId}/accountability`, accountabilityViewSchema)
      : null,
    isAdmin && tab === 'members'
      ? api(`/v1/groups/${groupId}/invitations`, invitationListSchema)
      : null,
    isAdmin && tab === 'websites'
      ? api(`/v1/groups/${groupId}/domains`, groupDomainListSchema)
      : null,
    isAdmin && tab === 'websites'
      ? api(`/v1/groups/${groupId}/domains/audit`, domainAuditListSchema)
      : null,
  ]);
  const memberName = (userId: string) =>
    members.items.find((m) => m.userId === userId)?.displayName ??
    (userId === me.userId ? 'You' : 'A former member');
  const category = (type?: string) => (type === 'NON_NEGOTIABLE' ? 'non-negotiable' : 'additional');
  const adminCount = members.items.filter((m) => m.role === 'ADMIN').length;

  const list = 'bg-card divide-y rounded-xl border';
  return (
    <div>
      <div className="mb-8 space-y-3">
        <Link
          href="/dashboard/groups"
          className="text-muted-foreground hover:text-foreground text-sm hover:underline"
        >
          ← All groups
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
        <p className="text-muted-foreground text-base">
          You are {isAdmin ? 'an admin' : 'a member'} · {String(members.items.length)}{' '}
          {members.items.length === 1 ? 'member' : 'members'} · created{' '}
          <time dateTime={group.createdAt}>
            {new Date(group.createdAt).toLocaleDateString('en', dateFormat)}
          </time>
        </p>
      </div>

      <GroupTabs groupId={groupId} current={tab} />

      {tab === 'websites' && (
        <>
          <SettingsRow
            id="blocked"
            title="Blocked websites"
            description={
              isAdmin ? (
                <>
                  <p>Every member’s browser blocks these websites, including their subdomains.</p>
                  <p>Members can add websites too, but only admins can see or change the list.</p>
                </>
              ) : (
                <>
                  <p>Add a website for everyone in this group to block. It applies right away.</p>
                  <p>Only admins can see the full list.</p>
                </>
              )
            }
          >
            <div className="space-y-4">
              <BlockDomainForm groupId={groupId} isAdmin={isAdmin} />
              <details className="bg-card rounded-xl border">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none">
                  Add several websites at once
                  <span className="text-muted-foreground block font-normal sm:inline">
                    {' '}
                    Paste a list, or upload a spreadsheet or JSON file
                  </span>
                </summary>
                <div className="border-t px-4 py-4">
                  <BulkDomainForm
                    groupId={groupId}
                    isAdmin={isAdmin}
                    {...(domains && { room: MAX_GROUP_DOMAINS - domains.items.length })}
                  />
                </div>
              </details>
              {domains &&
                (domains.items.length === 0 ? (
                  <p className="bg-card rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                    No websites blocked yet. Add the first one above.
                  </p>
                ) : (
                  (['NON_NEGOTIABLE', 'ADDITIONAL'] as const).map((type) => {
                    const entries = domains.items.filter((entry) => entry.type === type);
                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="text-sm font-semibold">
                            {type === 'NON_NEGOTIABLE' ? 'Non-negotiable' : 'Additional'}{' '}
                            <span className="text-muted-foreground font-normal tabular-nums">
                              {String(entries.length)}
                            </span>
                          </h3>
                          <p className="text-muted-foreground text-xs">
                            {type === 'NON_NEGOTIABLE'
                              ? 'Blocked · a deliberate visit can alert partners'
                              : 'Blocked · never sends alerts'}
                          </p>
                        </div>
                        {entries.length === 0 ? (
                          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-3 text-sm">
                            None yet.
                          </p>
                        ) : (
                          <ul className={list + ' text-sm'}>
                            {entries.map((entry) => (
                              <li
                                key={entry.domain}
                                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <span
                                    aria-hidden="true"
                                    className={
                                      type === 'NON_NEGOTIABLE'
                                        ? 'size-2 shrink-0 rounded-full bg-amber-500'
                                        : 'size-2 shrink-0 rounded-full bg-slate-400'
                                    }
                                  />
                                  <div className="min-w-0">
                                    <p className="font-medium break-all">{entry.domain}</p>
                                    <p className="text-muted-foreground text-xs">
                                      Added{' '}
                                      {new Date(entry.createdAt).toLocaleDateString(
                                        'en',
                                        dateFormat,
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <DomainActions
                                  groupId={groupId}
                                  domain={entry.domain}
                                  type={entry.type}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })
                ))}
              {audit && audit.items.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">Recent changes</summary>
                  <ul className="mt-2 space-y-1">
                    {audit.items.map((entry) => (
                      <li
                        key={entry.at + entry.domain + entry.action}
                        className="text-muted-foreground"
                      >
                        {new Date(entry.at).toLocaleString('en', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}{' '}
                        · {memberName(entry.actorId)}{' '}
                        {entry.action === 'ADDED'
                          ? 'added ' + entry.domain + ' (' + category(entry.to) + ')'
                          : entry.action === 'REMOVED'
                            ? 'removed ' + entry.domain
                            : 'changed ' + entry.domain + ' to ' + category(entry.to)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </SettingsRow>
        </>
      )}

      {tab === 'accountability' && accountability && (
        <>
          <SettingsRow
            id="accountability"
            title="Accountability"
            description={
              <p>
                Your choice alone; admins can’t see or change it. Only two things send an alert: a
                blocked visit to a non-negotiable website, and someone leaving or being removed from
                the group. Alerts never name the website, and a blocked visit is not proof of
                intent.
              </p>
            }
          >
            <AccountabilityPanel
              groupId={groupId}
              view={accountability}
              others={members.items
                .filter((m) => m.userId !== me.userId)
                .map((m) => ({ userId: m.userId, name: m.displayName ?? 'Unnamed member' }))}
            />
          </SettingsRow>
        </>
      )}

      {tab === 'members' && (
        <>
          <SettingsRow
            id="members"
            title="Members"
            description={
              <p>
                {String(members.items.length)} {members.items.length === 1 ? 'member' : 'members'},{' '}
                {String(adminCount)} {adminCount === 1 ? 'admin' : 'admins'}. Members see each
                other&apos;s display names and roles.
              </p>
            }
          >
            <ul className={list}>
              {members.items.map((member) => {
                const self = member.userId === me.userId;
                const name = member.displayName ?? (self ? 'You' : 'Unnamed member');
                return (
                  <li
                    key={member.userId}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="bg-muted grid size-8 shrink-0 place-items-center rounded-full text-sm font-medium"
                      >
                        {name.trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className="truncate">
                            {name}
                            {self && member.displayName && (
                              <span className="text-muted-foreground font-normal"> (you)</span>
                            )}
                          </span>
                          <span
                            className={
                              member.role === 'ADMIN'
                                ? 'bg-primary text-primary-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium'
                                : 'bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium'
                            }
                          >
                            {member.role === 'ADMIN' ? 'Admin' : 'Member'}
                          </span>
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Joined {new Date(member.joinedAt).toLocaleDateString('en', dateFormat)}
                        </p>
                      </div>
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
                            <RemoveMemberButton
                              groupId={groupId}
                              userId={member.userId}
                              name={name}
                            />
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
          </SettingsRow>

          {isAdmin && invitations && (
            <SettingsRow
              id="invite"
              title="Invite people"
              description={
                <p>
                  Anyone with a link can join until it expires or is used up. Send it only to people
                  you trust.
                </p>
              }
            >
              <div className="space-y-4">
                <InvitePanel groupId={groupId} />
                {invitations.items.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Active invite links</h3>
                    <ul className={list + ' text-sm'}>
                      {invitations.items.map((inv) => (
                        <li
                          key={inv.invitationId}
                          className="flex items-center justify-between gap-4 px-4 py-3"
                        >
                          <span className="tabular-nums">
                            {String(inv.uses)} of {String(inv.maxUses)} used · expires{' '}
                            {new Date(inv.expiresAt).toLocaleDateString('en', dateFormat)}
                          </span>
                          <RevokeInvitationButton
                            groupId={groupId}
                            invitationId={inv.invitationId}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </SettingsRow>
          )}
        </>
      )}

      {tab === 'settings' && (
        <>
          {isAdmin && (
            <SettingsRow
              id="settings"
              title="Group name"
              description={<p>Shown to every member.</p>}
            >
              <RenameGroupForm groupId={groupId} name={group.name} />
            </SettingsRow>
          )}

          <SettingsRow
            id="leave"
            title="Leave this group"
            description={
              <p>
                The extension stops protecting for this group. Members who agreed to receive your
                alerts are told you left.
              </p>
            }
          >
            {isAdmin && adminCount <= 1 ? (
              <p className="text-sm">
                You are the only admin. Make another member an admin first, or dissolve the group.
              </p>
            ) : (
              <LeaveGroupButton groupId={groupId} />
            )}
          </SettingsRow>

          {isAdmin && (
            <SettingsRow
              id="dissolve"
              title="Dissolve group"
              tone="danger"
              description={<p>Removes the group for everyone. This cannot be undone.</p>}
            >
              <DissolveGroupPanel groupId={groupId} name={group.name} />
            </SettingsRow>
          )}
        </>
      )}
    </div>
  );
}
