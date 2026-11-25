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
          title: 'Accountability sharing',
          state: 'done',
          detail:
            sharingGroup.sharing.receiving === 0
              ? `Set up in ${sharingGroup.name}. No one has agreed to receive your alerts yet.`
              : `Set up in ${sharingGroup.name}. ${String(sharingGroup.sharing.receiving)} agreed to receive your alerts.`,
        }
      : {
          id: 'sharing',
          title: 'Accountability sharing',
          state: 'todo',
          detail: firstGroup
            ? 'Your alerts are private. Choose who may receive them in your group.'
            : 'Available once you are in a group.',
          ...(firstGroup && {
            action: {
              label: 'Choose who',
              href: `/dashboard/groups/${firstGroup.groupId}#accountability`,
            },
          }),
        },
  ];
}

const STRENGTH = ['Not set up', 'Weak', 'Fair', 'Strong'] as const;

function StateMark({ state }: { state: ItemState }) {
  if (state === 'done') {
    return (
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className="shrink-0">
        <circle cx="10" cy="10" r="9" className="fill-foreground" />
        <path
          d="m6 10.2 2.6 2.6L14 7.4"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-background"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className="shrink-0">
      <circle
        cx="10"
        cy="10"
        r="8.25"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray={state === 'checking' ? '3 3' : undefined}
        className="stroke-muted-foreground"
      />
    </svg>
  );
}

function Panel({
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
  const id = `panel-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section
      aria-labelledby={id}
      className={cn('bg-muted/60 flex flex-col rounded-2xl p-5', className)}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-sm font-semibold">
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
    <Panel
      title="Resolve checklist"
      className="lg:col-span-9"
      aside={
        <p className="text-muted-foreground text-sm tabular-nums">
          {checking ? 'Checking…' : `${String(score)} of ${String(items.length)}`}
        </p>
      }
    >
      <div className="mb-5 flex items-center gap-4">
        <div
          role="meter"
          aria-label="Setup strength"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={score}
          aria-valuetext={`${STRENGTH[score] ?? ''}: ${String(score)} of ${String(items.length)} set up`}
          className="flex flex-1 gap-1.5"
        >
          {items.map((item, i) => (
            <span
              key={item.id}
              className={cn('h-1.5 flex-1 rounded-full', i < score ? 'bg-foreground' : 'bg-border')}
            />
          ))}
        </div>
        <p className="min-w-16 text-right text-sm font-semibold">
          {checking ? '—' : STRENGTH[score]}
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="bg-card flex flex-col gap-3 rounded-xl border px-4 py-3.5 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <StateMark state={item.state} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {item.title}
                  <span className="sr-only">
                    {item.state === 'done' ? ' (done)' : item.state === 'todo' ? ' (to do)' : ''}
                  </span>
                </p>
                <p className="text-muted-foreground text-sm">{item.detail}</p>
              </div>
            </div>
            {item.action && item.state === 'todo' && (
              <Link
                href={item.action.href}
                className="hover:bg-muted ml-8 shrink-0 self-start rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors sm:ml-0 sm:self-center"
              >
                {item.action.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-4 text-xs">
        Three of three is strong. Media blurring is checked in the browser you are using now.
      </p>
    </Panel>
  );
}

function BrowserPanel({ extension }: { extension: ExtensionStatus }) {
  const line =
    extension.state === 'checking'
      ? { title: 'Checking…', text: 'Looking for the Resolve extension in this browser.' }
      : extension.state === 'absent'
        ? {
            title: 'No extension found',
            text: 'Resolve works through its extension for Chrome, Edge and Brave on a computer.',
          }
        : {
            title: extension.signedIn ? 'Extension signed in' : 'Extension signed out',
            text: extension.signedIn
              ? `Blurring is ${extension.mediaBlur ? 'on' : 'off'}. Choose your active group in the extension's popup.`
              : 'Open the Resolve extension and sign in with this account to protect this browser.',
          };
  return (
    <Panel title="This browser" className="lg:col-span-3">
      <div className="bg-card flex flex-1 flex-col rounded-xl border p-4">
        <p className="text-base font-semibold">{line.title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{line.text}</p>
        <ul className="mt-4 space-y-1.5 border-t pt-4 text-sm">
          <li>Blocks your group’s websites</li>
          <li>Blurs images and videos on this device</li>
          <li>Reports blocked visits only if you share</li>
        </ul>
        <Link
          href="/getting-started"
          className="mt-auto pt-4 text-sm font-medium underline underline-offset-4"
        >
          {extension.state === 'absent' ? 'Install the extension' : 'Getting started'}
        </Link>
      </div>
    </Panel>
  );
}

function sharingLabel(sharing: HomeGroup['sharing']) {
  if (!sharing) return '—';
  if (sharing.mode === 'PRIVATE') return 'Private';
  return sharing.mode === 'EVERYONE' ? 'Shared with everyone' : 'Shared with selected';
}

const GROUP_ROWS = 4;

/** Group rows on the home: all of up to four; otherwise three and an "All N groups" row. */
function groupRowsShown(count: number) {
  return count <= GROUP_ROWS ? count : GROUP_ROWS - 1;
}

/** Rows in the groups panel: its groups plus the create or "All" row (none at exactly four). */
function groupPanelRows(count: number) {
  if (count === 0) return 2;
  return count === GROUP_ROWS ? GROUP_ROWS : groupRowsShown(count) + 1;
}

function GroupsPanel({ groups }: { groups: HomeGroup[] }) {
  return (
    <Panel
      title="Your groups"
      className="lg:col-span-6"
      aside={
        groups.length > 0 && (
          <Link href="/dashboard/groups" className="text-sm underline underline-offset-4">
            {groups.length > GROUP_ROWS ? `View all ${String(groups.length)}` : 'Manage'}
          </Link>
        )
      }
    >
      {groups.length === 0 ? (
        <div className="bg-card flex flex-1 flex-col items-start justify-center gap-3 rounded-xl border border-dashed p-4">
          <p className="text-sm">You are not in a group yet.</p>
          <Link
            href="/dashboard/groups"
            className="bg-primary text-primary-foreground hover:bg-primary-pressed rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            Create a group
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.slice(0, groupRowsShown(groups.length)).map((group) => (
            <li key={group.groupId}>
              <Link
                href={`/dashboard/groups/${group.groupId}`}
                className="bg-card hover:border-foreground/30 flex h-[63px] items-center justify-between gap-3 rounded-xl border px-4 transition-colors"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{group.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {sharingLabel(group.sharing)}
                  </span>
                </span>
                <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {group.role === 'ADMIN' ? 'Admin' : 'Member'}
                </span>
              </Link>
            </li>
          ))}
          {groups.length !== GROUP_ROWS && (
            <li>
              <Link
                href={
                  groups.length > GROUP_ROWS
                    ? '/dashboard/groups'
                    : '/dashboard/groups#create-group'
                }
                className="hover:border-foreground/30 flex h-[63px] flex-col justify-center rounded-xl border border-dashed px-4 transition-colors"
              >
                <span className="text-sm font-semibold">
                  {groups.length > GROUP_ROWS
                    ? `All ${String(groups.length)} groups`
                    : 'Create another group'}
                </span>
                <span className="text-muted-foreground text-xs">
                  {groups.length > GROUP_ROWS
                    ? 'Open the full list'
                    : 'Or open an invitation link from a group admin'}
                </span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}

const LEARN = [
  {
    href: '/getting-started',
    title: 'Getting started',
    text: 'Install, sign in and set up a group.',
  },
  { href: '/about', title: 'About Resolve', text: 'What it does, and what it never does.' },
  { href: '/privacy', title: 'Privacy', text: 'What is stored, and for how long.' },
  { href: '/support', title: 'Support', text: 'Questions, problems and feedback.' },
] as const;

function LearnPanel({ rows }: { rows: number }) {
  return (
    <Panel title="Learn" className="lg:col-span-6">
      <ul className="space-y-2">
        {LEARN.slice(0, rows).map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="bg-card hover:border-foreground/30 flex h-[63px] flex-col justify-center rounded-xl border px-4 transition-colors"
            >
              <span className="text-sm font-semibold">{item.title}</span>
              <span className="text-muted-foreground text-xs">{item.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Tile({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="bg-card flex min-h-32 flex-col rounded-2xl border p-4 lg:col-span-3">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-2 text-2xl tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-auto pt-2 text-xs">{caption}</p>
    </div>
  );
}

function headline(name: string, score: number, checking: boolean) {
  if (checking) return `${name}, here is your Resolve.`;
  if (score === 3) return `${name}, your setup is strong.`;
  if (score === 2) return `${name}, one step to go.`;
  return `${name}, let’s finish setting up.`;
}

/** The signed-in home: the setup checklist first, then the groups and what to read next. */
export function HomeScreen({ name, groups }: { name: string; groups: HomeGroup[] }) {
  const extension = useExtensionStatus();
  const items = checklistItems(groups, extension);
  const checking = items.some((i) => i.state === 'checking');
  const score = items.filter((i) => i.state === 'done').length;
  const admins = groups.filter((g) => g.role === 'ADMIN').length;
  const known = groups.filter((g) => g.sharing);
  const sharing = known.filter((g) => g.sharing?.mode !== 'PRIVATE');
  const partners = known.reduce((sum, g) => sum + (g.sharing?.receiving ?? 0), 0);

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <h1 className="font-display text-3xl leading-tight sm:text-[2.5rem]">
          {headline(name, score, checking)}
        </h1>
        <p className="text-muted-foreground text-base">
          {checking
            ? 'Checking this browser for the Resolve extension…'
            : `${String(score)} of 3 setup steps done${
                groups.length > 0
                  ? ` · ${String(groups.length)} ${groups.length === 1 ? 'group' : 'groups'}`
                  : ''
              }.`}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-12">
        <Tile
          label="Groups"
          value={String(groups.length)}
          caption={
            groups.length === 0
              ? 'Create or join one'
              : groups.length === 1
                ? (groups[0]?.name ?? '')
                : 'you belong to'
          }
        />
        <Tile
          label="Groups you admin"
          value={String(admins)}
          caption={admins === 0 ? 'Admins manage the list' : 'You manage their websites'}
        />
        <Tile
          label="Sharing alerts in"
          value={known.length === groups.length ? String(sharing.length) : '—'}
          caption={
            sharing.length === 0
              ? 'Private everywhere'
              : `of ${String(groups.length)} ${groups.length === 1 ? 'group' : 'groups'}`
          }
        />
        <Tile
          label="Partners receiving"
          value={known.length === groups.length ? String(partners) : '—'}
          caption={partners === 0 ? 'No one has agreed yet' : 'agreed to get your alerts'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Checklist items={items} />
        <BrowserPanel extension={extension} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <GroupsPanel groups={groups} />
        <LearnPanel rows={groupPanelRows(groups.length)} />
      </div>
    </div>
  );
}
