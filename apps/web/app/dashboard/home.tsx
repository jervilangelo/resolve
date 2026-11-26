/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import type { GroupRole, SharingMode } from '@resolve/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRightIcon, CheckIcon, DownloadIcon, UsersIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { type ExtensionStatus, useExtensionStatus } from '@/lib/extension-status';
import { cn } from '@/lib/utils';

export interface HomeGroup {
  groupId: string;
  name: string;
  role: GroupRole;
  /** Null when it could not be read (shown as a dash). */
  sharing: { mode: SharingMode; receiving: number } | null;
}

type ItemState = 'done' | 'todo' | 'checking';

interface ChecklistItem {
  id: string;
  title: string;
  state: ItemState;
  detail: string;
  action?: { label: string; href: string };
}

/** The three steps that make Resolve strong; the score is how many are done. */
export function checklistItems(groups: HomeGroup[], extension: ExtensionStatus): ChecklistItem[] {
  const sharingGroup = groups.find((g) => g.sharing && g.sharing.mode !== 'PRIVATE');
  const firstGroup = groups[0];
  const media: ChecklistItem =
    extension.state === 'checking'
      ? {
          id: 'media',
          title: 'Media blurring',
          state: 'checking',
          detail: 'Checking this browser…',
        }
      : extension.state === 'absent'
        ? {
            id: 'media',
            title: 'Media blurring',
            state: 'todo',
            detail:
              'Install the Resolve extension in this browser, then turn on "Blur sensitive images and videos" in its Settings.',
            action: { label: 'How to install', href: '/getting-started' },
          }
        : extension.mediaBlur
          ? {
              id: 'media',
              title: 'Media blurring',
              state: 'done',
              detail:
                'On in this browser. Images and videos are checked on your device, never uploaded.',
            }
          : {
              id: 'media',
              title: 'Media blurring',
              state: 'todo',
              detail:
                'Open the Resolve extension, choose Settings and turn on "Blur sensitive images and videos".',
            };
  return [
    media,
    groups.length > 0
      ? {
          id: 'group',
          title: 'Joining a group',
          state: 'done',
          detail:
            groups.length === 1
              ? `You are in ${groups[0]?.name ?? 'a group'}.`
              : `You are in ${String(groups.length)} groups.`,
        }
      : {
          id: 'group',
          title: 'Joining a group',
          state: 'todo',
          detail: 'Create a group, or open an invitation link from a group admin.',
          action: { label: 'Create a group', href: '/dashboard/groups' },
        },
    sharingGroup?.sharing
      ? {
          id: 'sharing',
          title: 'Accountability alerts',
          state: 'done',
          detail:
            sharingGroup.sharing.receiving === 0
              ? `Set up in ${sharingGroup.name}. No one has agreed to receive your alerts yet.`
              : `Set up in ${sharingGroup.name}. ${String(sharingGroup.sharing.receiving)} agreed to receive your alerts.`,
        }
      : {
          id: 'sharing',
          title: 'Accountability alerts',
          state: 'todo',
          detail: firstGroup
            ? 'Alerts are off. Turn them on in your group and choose your partners.'
            : 'Available once you are in a group.',
          ...(firstGroup && {
            action: {
              label: 'Set up alerts',
              href: `/dashboard/groups/${firstGroup.groupId}?tab=accountability`,
            },
          }),
        },
  ];
}

const STRENGTH = ['Not set up', 'Weak', 'Fair', 'Strong'] as const;

function StateMark({ state }: { state: ItemState }) {
  if (state === 'done') {
    return (
      <span className="bg-foreground text-background grid size-6 shrink-0 place-items-center rounded-full">
        <CheckIcon width={14} height={14} strokeWidth={2.4} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'size-6 shrink-0 rounded-full border-2',
        state === 'checking' ? 'border-muted-foreground/40 border-dashed' : 'border-border',
      )}
    />
  );
}

type Tone = 'good' | 'warn' | 'off';

function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'good' &&
          'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
        tone === 'warn' && 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
        tone === 'off' && 'bg-muted text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          tone === 'good' ? 'bg-emerald-600' : tone === 'warn' ? 'bg-amber-500' : 'bg-slate-400',
        )}
      />
      {children}
    </span>
  );
}

function ago(ms: number) {
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)} min ago`;
  return `${String(Math.round(minutes / 60))} h ago`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}

/** What the Resolve extension in this browser is doing right now. */
function BrowserCard({ extension, groups }: { extension: ExtensionStatus; groups: HomeGroup[] }) {
  if (extension.state === 'checking') {
    return (
      <Card title="This browser" className="lg:col-span-7">
        <div role="status" className="text-muted-foreground flex items-center gap-3 py-6 text-sm">
          <Spinner />
          Looking for the Resolve extension…
        </div>
      </Card>
    );
  }
  if (extension.state === 'absent') {
    return (
      <Card
        title="This browser"
        className="lg:col-span-7"
        aside={<Status tone="off">Not connected</Status>}
      >
        <div className="flex flex-col items-start gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground max-w-sm text-sm">
            The Resolve extension isn’t installed in this browser, or this browser can’t talk to it.
            Protection runs through the extension.
          </p>
          <Button asChild>
            <Link href="/downloads">
              <DownloadIcon />
              Get the extension
            </Link>
          </Button>
        </div>
      </Card>
    );
  }
  const d = extension.details;
  const active = d?.activeGroupId ? groups.find((g) => g.groupId === d.activeGroupId) : undefined;
  const blocking: [Tone, string] = !d
    ? ['off', 'Update the extension to see this']
    : d.protection === 'on'
      ? ['good', `On${d.syncedAt ? ` · synced ${ago(d.syncedAt)}` : ''}`]
      : d.protection === 'idle'
        ? ['good', 'On · no websites listed yet']
        : d.protection === 'stale'
          ? ['warn', 'On · list out of date']
          : d.protection === 'starting'
            ? ['warn', 'Turning on…']
            : d.protection === 'error'
              ? ['warn', 'Not working · open the extension']
              : ['off', 'Off'];
  const media: [Tone, string] = !d
    ? extension.mediaBlur
      ? ['good', 'On']
      : ['off', 'Off']
    : d.media === 'on'
      ? ['good', 'On']
      : d.media === 'needsAccess'
        ? ['warn', 'Needs site access']
        : d.media === 'unsupported'
          ? ['off', 'Not supported']
          : ['off', 'Off'];
  const alerts: [Tone, string] = !d
    ? ['off', '—']
    : d.alerts === 'on'
      ? ['good', 'On']
      : d.alerts === 'inactive'
        ? ['warn', 'On, but inactive']
        : d.alerts === 'unsupported'
          ? ['off', 'Not supported']
          : ['off', 'Off'];

  return (
    <Card
      title="This browser"
      className="lg:col-span-7"
      aside={
        extension.signedIn ? (
          <Status tone="good">Connected</Status>
        ) : (
          <Status tone="warn">Signed out</Status>
        )
      }
    >
      {!extension.signedIn ? (
        <p className="text-muted-foreground py-2 text-sm">
          The extension is installed but signed out. Open it from your browser’s toolbar and sign in
          with this account.
        </p>
      ) : (
        <dl className="divide-y">
          <Row label="Active group">
            {active ? (
              <Link
                href={`/dashboard/groups/${active.groupId}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {active.name}
              </Link>
            ) : !d ? (
              <span className="text-muted-foreground">Update the extension to see this</span>
            ) : d.activeGroupId ? (
              <span className="text-muted-foreground">A group on another account</span>
            ) : (
              <span className="text-muted-foreground">None · choose one in the extension</span>
            )}
          </Row>
          <Row label="Website blocking">
            <Status tone={blocking[0]}>{blocking[1]}</Status>
          </Row>
          <Row label="Media blurring">
            <Status tone={media[0]}>{media[1]}</Status>
          </Row>
          <Row label="Blocked-visit alerts">
            <Status tone={alerts[0]}>{alerts[1]}</Status>
          </Row>
        </dl>
      )}
      <p className="text-muted-foreground mt-3 text-xs">
        Change these in the extension’s popup and settings{d ? ` · version ${d.version}` : ''}.
      </p>
    </Card>
  );
}

function Card({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = `card-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section
      aria-labelledby={id}
      className={cn('bg-card flex flex-col rounded-2xl border p-5 sm:p-6', className)}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Checklist({ items }: { items: ChecklistItem[] }) {
  const checking = items.some((i) => i.state === 'checking');
  const score = items.filter((i) => i.state === 'done').length;
  return (
    <Card
      title="Resolve checklist"
      className="lg:col-span-5"
      aside={
        <span className="text-sm font-semibold">
          {checking ? '—' : STRENGTH[score]}
          <span className="text-muted-foreground font-normal tabular-nums">
            {checking ? '' : ` · ${String(score)}/${String(items.length)}`}
          </span>
        </span>
      }
    >
      <div
        role="meter"
        aria-label="Setup strength"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={score}
        aria-valuetext={`${STRENGTH[score] ?? ''}: ${String(score)} of ${String(items.length)} set up`}
        className="mb-4 flex gap-1.5"
      >
        {items.map((item, i) => (
          <span
            key={item.id}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < score ? 'bg-foreground' : 'bg-border',
            )}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-xl py-2.5">
            <StateMark state={item.state} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {item.title}
                <span className="sr-only">
                  {item.state === 'done' ? ' (done)' : item.state === 'todo' ? ' (to do)' : ''}
                </span>
              </p>
              <p className="text-muted-foreground text-sm">{item.detail}</p>
              {item.action && item.state === 'todo' && (
                <Link
                  href={item.action.href}
                  className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  {item.action.label}
                  <ArrowRightIcon width={14} height={14} />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function sharingLabel(sharing: HomeGroup['sharing']) {
  if (!sharing) return 'Alerts: —';
  if (sharing.mode === 'PRIVATE') return 'Alerts off';
  return sharing.mode === 'EVERYONE'
    ? 'Alerts to everyone who agreed'
    : 'Alerts to chosen partners';
}

function GroupsCard({ groups, activeId }: { groups: HomeGroup[]; activeId: string | null }) {
  return (
    <Card
      title="Your groups"
      className="lg:col-span-7"
      aside={
        groups.length > 0 && (
          <Link
            href="/dashboard/groups"
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            Manage
          </Link>
        )
      }
    >
      {groups.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-5">
          <p className="font-medium">You’re not in a group yet</p>
          <p className="text-muted-foreground text-sm">
            Groups decide which websites are blocked and who your accountability partners can be.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/groups">Create or join a group</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y">
          {groups.map((group) => (
            <li key={group.groupId}>
              <Link
                href={`/dashboard/groups/${group.groupId}`}
                className="hover:bg-muted/60 -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold">
                    {group.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{group.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {sharingLabel(group.sharing)}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {group.groupId === activeId && <Status tone="good">Active here</Status>}
                  <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {group.role === 'ADMIN' ? 'Admin' : 'Member'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function QuickActions() {
  const actions = [
    {
      href: '/dashboard/groups#create-group',
      title: 'Create a group',
      text: 'Become its admin and invite people.',
      icon: <UsersIcon />,
    },
    {
      href: '/dashboard/groups#join-group',
      title: 'Join with an invite link',
      text: 'Paste a link a group admin sent you.',
      icon: <ArrowRightIcon />,
    },
    {
      href: '/downloads',
      title: 'Download the extension',
      text: 'Chrome, Edge and Brave.',
      icon: <DownloadIcon />,
    },
  ];
  return (
    <Card title="Quick actions" className="lg:col-span-5">
      <ul className="space-y-2">
        {actions.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="hover:border-foreground/25 flex items-center gap-3 rounded-xl border p-3 transition-colors"
            >
              <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-lg">
                {a.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold">{a.title}</span>
                <span className="text-muted-foreground block text-xs">{a.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function headline(name: string, score: number, checking: boolean) {
  if (checking) return `Welcome, ${name}.`;
  if (score === 3) return `${name}, your setup is strong.`;
  if (score === 2) return `${name}, one step to go.`;
  return `${name}, let’s finish setting up.`;
}

/** The signed-in home: this browser's protection first, then setup and groups. */
export function HomeScreen({ name, groups }: { name: string; groups: HomeGroup[] }) {
  const extension = useExtensionStatus();
  const items = checklistItems(groups, extension);
  const checking = items.some((i) => i.state === 'checking');
  const score = items.filter((i) => i.state === 'done').length;
  const activeId =
    extension.state === 'present' && extension.signedIn
      ? (extension.details?.activeGroupId ?? null)
      : null;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          {headline(name, score, checking)}
        </h1>
        <p className="text-muted-foreground">
          {groups.length === 0
            ? 'Start by creating or joining a group.'
            : `${String(groups.length)} ${groups.length === 1 ? 'group' : 'groups'} · ${String(score)} of 3 setup steps done`}
        </p>
      </header>
      <div className="grid gap-5 lg:grid-cols-12">
        <BrowserCard extension={extension} groups={groups} />
        <Checklist items={items} />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <GroupsCard groups={groups} activeId={activeId} />
        <QuickActions />
      </div>
    </div>
  );
}
