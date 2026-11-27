/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import {
  type AccountabilityView,
  INACTIVITY_GRACE_HOURS,
  type SharingMode,
} from '@resolve/contracts';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { saveSharing, setAcceptAll, setAlertType, setSenderConsent } from './actions';

interface Person {
  userId: string;
  name: string;
}

function ProblemText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

/** Who may receive the caller's alerts: off by default, turned on only by an explicit choice. */
function SharingForm({
  groupId,
  view,
  others,
}: {
  groupId: string;
  view: AccountabilityView;
  others: Person[];
}) {
  const on = view.sharing.mode !== 'PRIVATE';
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<'SELECTED' | 'EVERYONE'>(
    view.sharing.mode === 'EVERYONE' ? 'EVERYONE' : 'SELECTED',
  );
  const [chosen, setChosen] = useState<string[]>(view.sharing.recipientIds);
  const [confirmOff, setConfirmOff] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const selected = chosen.filter((id) => others.some((p) => p.userId === id));
  const canSave = mode === 'EVERYONE' || selected.length > 0;

  function save(next: SharingMode, ids: string[], message: string, after?: () => void) {
    setError(null);
    start(async () => {
      const result = await saveSharing(groupId, next, ids);
      if (result.error) {
        setError(result.error);
        setConfirmOff(false);
        return;
      }
      toast(message);
      setEditing(false);
      after?.();
    });
  }

  const statusPill = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        on
          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
          : 'bg-muted text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', on ? 'bg-emerald-600' : 'bg-slate-400')}
      />
      {on ? 'On' : 'Off'}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            Accountability alerts {statusPill}
          </p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {on
              ? view.sharing.mode === 'EVERYONE'
                ? 'Everyone in this group who agrees may receive your alerts.'
                : 'The partners you chose may receive your alerts, once they agree.'
              : 'No one receives alerts about you. This is the default.'}
          </p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            {on ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(true);
                  }}
                >
                  Change partners
                </Button>
                <ConfirmDialog
                  open={confirmOff}
                  onOpenChange={setConfirmOff}
                  pending={pending}
                  title="Turn off accountability alerts?"
                  description="No one in this group will receive alerts about you. You can turn them on again at any time."
                  confirmLabel="Turn off"
                  trigger={
                    <Button size="sm" variant="outline">
                      Turn off
                    </Button>
                  }
                  onConfirm={() => {
                    save('PRIVATE', [], 'Accountability alerts turned off.', () => {
                      setConfirmOff(false);
                    });
                  }}
                />
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(true);
                }}
              >
                Turn on alerts
              </Button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="bg-card rs-page space-y-5 rounded-xl border p-4 sm:p-5">
          {!on && (
            <div className="bg-muted/70 space-y-2 rounded-lg p-4 text-sm">
              <p className="font-semibold">Before you turn this on</p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                <li>
                  If you deliberately try to open a website this group’s admins marked
                  non-negotiable, the partners below may get an email. Websites members added never
                  send one.
                </li>
                <li>Leaving or being removed from this group may also notify them.</li>
                <li>Alerts never name the website, and nothing is sent until a partner agrees.</li>
                <li>
                  The extension must have “Alert my accountability partners” turned on in its
                  settings.
                </li>
              </ul>
            </div>
          )}

          <fieldset disabled={pending}>
            <legend className="mb-3 text-sm font-medium">Who may receive them</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['SELECTED', 'Partners I choose', 'Only the members you pick below.'],
                  ['EVERYONE', 'Everyone in this group', 'Any member who agrees.'],
                ] as const
              ).map(([value, label, detail]) => (
                <label
                  key={value}
                  className={cn(
                    'relative flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3.5 transition-[border-color,box-shadow]',
                    'has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]',
                    mode === value
                      ? 'border-foreground ring-foreground ring-1'
                      : 'hover:border-foreground/30',
                  )}
                >
                  <input
                    type="radio"
                    name="sharing-mode"
                    className="sr-only"
                    checked={mode === value}
                    onChange={() => {
                      setMode(value);
                    }}
                  />
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-muted-foreground text-xs">{detail}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {mode === 'SELECTED' && (
            <fieldset disabled={pending} className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Your partners</legend>
              {others.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed px-3.5 py-3 text-sm">
                  No one else is in this group yet. Invite someone first.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {others.map((person) => (
                    <li key={person.userId}>
                      <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm">
                        <input
                          type="checkbox"
                          className="accent-foreground size-4"
                          checked={selected.includes(person.userId)}
                          onChange={(event) => {
                            setChosen((current) =>
                              event.target.checked
                                ? [...current, person.userId]
                                : current.filter((id) => id !== person.userId),
                            );
                          }}
                        />
                        {person.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}

          <ProblemText message={error} />
          <div className="flex flex-wrap gap-2">
            <Button
              loading={pending}
              disabled={pending || !canSave}
              onClick={() => {
                save(
                  mode,
                  mode === 'SELECTED' ? selected : [],
                  on ? 'Partners updated.' : 'Accountability alerts turned on.',
                );
              }}
            >
              {on ? 'Save partners' : 'Turn on alerts'}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!editing && error && <ProblemText message={error} />}

      {on && view.recipients.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Partners</h4>
          <ul className="bg-card divide-y rounded-xl border text-sm">
            {view.recipients.map((r) => (
              <li key={r.userId} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                <span>{r.displayName ?? 'Unnamed member'}</span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    r.status === 'receiving'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {r.status === 'receiving' ? 'Agreed' : 'Waiting to agree'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">Partners who haven’t agreed get nothing.</p>
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

const ALERT_TYPES = [
  {
    type: 'removal',
    label: 'Resolve removed from a browser',
    hint: 'When Resolve is removed from one of your enrolled browsers.',
  },
  {
    type: 'inactivity',
    label: 'Resolve stopped checking in',
    hint: `When an enrolled browser has not checked in for ${String(INACTIVITY_GRACE_HOURS)} hours.`,
  },
] as const;

/** Installation alerts (§7.4): off by default on both sides, chosen per type. */
function InstallAlertsForm({ groupId, view }: { groupId: string; view: AccountabilityView }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(side: 'share' | 'receive', type: 'removal' | 'inactivity', on: boolean) {
    setError(null);
    start(async () => {
      const result = await setAlertType(groupId, side, type, on);
      if (result.error) setError(result.error);
    });
  }

  const column = (side: 'share' | 'receive', title: string, note: string) => (
    <fieldset className="bg-card space-y-2 rounded-xl border p-3.5 text-sm" disabled={pending}>
      <legend className="sr-only">{title}</legend>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground text-xs">{note}</p>
      {ALERT_TYPES.map(({ type, label, hint }) => (
        <label key={type} className="flex cursor-pointer gap-3 pt-1">
          <input
            type="checkbox"
            className="accent-foreground mt-0.5 size-4"
            checked={view.alertTypes[side][type]}
            onChange={(event) => {
              toggle(side, type, event.target.checked);
            }}
          />
          <span>
            {label}
            <span className="text-muted-foreground block text-xs">{hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {column(
          'share',
          'Share with my partners',
          view.sharing.mode === 'PRIVATE'
            ? 'Your alerts are off, so nothing is sent until you turn them on above.'
            : 'Sent to the same partners as your other alerts, once they agree.',
        )}
        {column(
          'receive',
          'Receive from people I receive alerts from',
          'Only from members whose alerts you already agreed to receive.',
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        A browser takes part only after its owner turns on “Tell my partners if Resolve is removed
        or stops checking in” in the extension’s settings. Alerts give the person’s name, what
        happened and when; never a website. A browser that stops checking in may simply be closed,
        asleep or offline, and a removal made while offline is only noticed later, so treat these as
        a reason to check in with someone, not as proof.
      </p>
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
      <div className="space-y-3">
        <h3 className="font-semibold">Removal and check-in alerts</h3>
        <InstallAlertsForm groupId={groupId} view={view} />
      </div>
    </div>
  );
}
