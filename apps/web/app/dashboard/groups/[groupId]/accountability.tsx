/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import type { AccountabilityView, SharingMode } from '@resolve/contracts';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { saveSharing, setAcceptAll, setSenderConsent } from './actions';

interface Person {
  userId: string;
  name: string;
}

const MODES: { value: SharingMode; label: string; detail: string }[] = [
  {
    value: 'PRIVATE',
    label: 'Private',
    detail: 'No one gets alerts about you.',
  },
  {
    value: 'SELECTED',
    label: 'Selected members',
    detail: 'Only people you choose, once they agree.',
  },
  {
    value: 'EVERYONE',
    label: 'Everyone',
    detail: 'Every member who agrees.',
  },
];

function ProblemText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

/** Who may receive the caller's alerts. Only the caller can change this; admins cannot. */
function SharingForm({
  groupId,
  view,
  others,
}: {
  groupId: string;
  view: AccountabilityView;
  others: Person[];
}) {
  const [mode, setMode] = useState<SharingMode>(view.sharing.mode);
  const [chosen, setSelected] = useState<string[]>(view.sharing.recipientIds);
  // Only members still in the group count; someone who left drops out of the choice.
  const selected = chosen.filter((id) => others.some((person) => person.userId === id));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const dirty =
    mode !== view.sharing.mode ||
    (mode === 'SELECTED' &&
      [...selected].sort().join() !== [...view.sharing.recipientIds].sort().join());

  function save() {
    setError(null);
    start(async () => {
      const result = await saveSharing(groupId, mode, mode === 'SELECTED' ? selected : []);
      if (result.error) setError(result.error);
      else toast('Sharing saved.');
    });
  }

  return (
    <div className="space-y-4">
      <fieldset disabled={pending}>
        <legend className="mb-3 text-sm font-medium">Who may get alerts about you</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((option) => (
            <label
              key={option.value}
              className={cn(
                'bg-card relative flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3.5 transition-[border-color,box-shadow]',
                'has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]',
                mode === option.value
                  ? 'border-foreground ring-foreground ring-1'
                  : 'hover:border-foreground/30',
              )}
            >
              <input
                type="radio"
                name="sharing-mode"
                className="sr-only"
                checked={mode === option.value}
                onChange={() => {
                  setMode(option.value);
                }}
              />
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-muted-foreground text-xs">{option.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'SELECTED' && (
        <fieldset className="bg-card space-y-2 rounded-xl border p-3.5" disabled={pending}>
          <legend className="sr-only">Choose members</legend>
          <p className="text-sm font-medium">Choose members</p>
          {others.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nobody else is in this group yet. Invite someone first.
            </p>
          ) : (
            others.map((person) => (
              <label key={person.userId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(person.userId)}
                  onChange={(event) => {
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, person.userId]
                        : current.filter((id) => id !== person.userId),
                    );
                  }}
                />
                <span>{person.name}</span>
              </label>
            ))
          )}
        </fieldset>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" loading={pending} disabled={pending || !dirty} onClick={save}>
          Save sharing
        </Button>
        {!dirty && <p className="text-muted-foreground text-sm">No changes</p>}
      </div>
      <ProblemText message={error} />

      {view.recipients.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Who would get them</h4>
          <ul className="bg-card divide-y rounded-xl border text-sm">
            {view.recipients.map((r) => (
              <li key={r.userId} className="flex items-center justify-between gap-4 px-3 py-2">
                <span>{r.displayName ?? 'Unnamed member'}</span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    r.status === 'receiving'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {r.status === 'receiving' ? 'Agreed' : 'Not yet agreed'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">People who haven’t agreed get nothing.</p>
        </div>
      )}
    </div>
  );
}

/** Whose alerts the caller agrees to receive. Only the caller can change this. */
function ReceivingForm({ groupId, view }: { groupId: string; view: AccountabilityView }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>, id: string | null = null) {
    setError(null);
    setBusyId(id);
    start(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <label className="bg-card flex cursor-pointer gap-3 rounded-xl border p-3.5 text-sm">
        <input
          type="checkbox"
          className="accent-foreground mt-0.5 size-4"
          checked={view.receiving.acceptAll}
          disabled={pending}
          onChange={(event) => {
            const value = event.target.checked;
            run(() => setAcceptAll(groupId, value));
          }}
        />
        <span className="font-medium">
          Accept alerts from anyone here who shares with me
          <span className="text-muted-foreground block text-xs font-normal">
            Or agree person by person below.
          </span>
        </span>
      </label>

      {view.senders.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-3.5 py-3 text-sm">
          No one here shares their alerts with you yet.
        </p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border text-sm">
          {view.senders.map((s) => {
            const name = s.displayName ?? 'Unnamed member';
            const individually = s.status === 'receiving' && !view.receiving.acceptAll;
            return (
              <li
                key={s.userId}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
              >
                <span>
                  <span className="font-medium">{name}</span>{' '}
                  <span className="text-muted-foreground">
                    {s.status === 'receiving'
                      ? 'shares with you'
                      : 'asks you to receive their alerts'}
                  </span>
                </span>
                {s.status === 'needs_consent' ? (
                  <Button
                    size="sm"
                    loading={pending && busyId === s.userId}
                    disabled={pending}
                    onClick={() => {
                      run(() => setSenderConsent(groupId, s.userId, true), s.userId);
                    }}
                  >
                    Agree to receive
                  </Button>
                ) : individually ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      run(() => setSenderConsent(groupId, s.userId, false));
                    }}
                  >
                    Stop receiving
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-xs">Accepted (anyone)</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ProblemText message={error} />
    </div>
  );
}

export function AccountabilityPanel({
  groupId,
  view,
  others,
}: {
  groupId: string;
  view: AccountabilityView;
  others: Person[];
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h3 className="font-semibold">Your alerts</h3>
        <SharingForm groupId={groupId} view={view} others={others} />
      </div>
      <div className="space-y-3">
        <h3 className="font-semibold">Alerts from others</h3>
        <ReceivingForm groupId={groupId} view={view} />
      </div>
    </div>
  );
}
