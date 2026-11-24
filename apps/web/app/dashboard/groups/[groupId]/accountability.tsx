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
import { saveSharing, setAcceptAll, setSenderConsent } from './actions';

interface Person {
  userId: string;
  name: string;
}

const MODES: { value: SharingMode; label: string; detail: string }[] = [
  {
    value: 'PRIVATE',
    label: 'Private',
    detail: 'Nobody receives alerts about you. This is the default.',
  },
  {
    value: 'SELECTED',
    label: 'Selected members',
    detail: 'Only the members you choose, and only once they agree.',
  },
  {
    value: 'EVERYONE',
    label: 'Everyone in this group',
    detail: 'Every other member who agrees to receive your alerts.',
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
  const [saved, setSaved] = useState(false);
  const dirty =
    mode !== view.sharing.mode ||
    (mode === 'SELECTED' &&
      [...selected].sort().join() !== [...view.sharing.recipientIds].sort().join());

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await saveSharing(groupId, mode, mode === 'SELECTED' ? selected : []);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2" disabled={pending}>
        <legend className="mb-2 font-medium">Who may receive alerts about you</legend>
        {MODES.map((option) => (
          <label key={option.value} className="flex gap-2 text-sm">
            <input
              type="radio"
              name="sharing-mode"
              className="mt-1"
              checked={mode === option.value}
              onChange={() => {
                setMode(option.value);
                setSaved(false);
              }}
            />
            <span className="font-medium">
              {option.label}
              <span className="text-muted-foreground block text-xs font-normal">
                {option.detail}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {mode === 'SELECTED' && (
        <fieldset className="space-y-2 pl-6" disabled={pending}>
          <legend className="text-muted-foreground mb-1 text-sm">Choose members</legend>
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
                    setSaved(false);
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
        <Button type="button" disabled={pending || !dirty} onClick={save}>
          {pending ? 'Saving…' : 'Save sharing'}
        </Button>
        {saved && !dirty && (
          <p role="status" className="text-primary text-sm">
            Saved.
          </p>
        )}
      </div>
      <ProblemText message={error} />

      {view.recipients.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Your alerts would reach</h4>
          <ul className="divide-y rounded-md border text-sm">
            {view.recipients.map((r) => (
              <li key={r.userId} className="flex items-center justify-between gap-4 px-3 py-2">
                <span>{r.displayName ?? 'Unnamed member'}</span>
                <span
                  className={r.status === 'receiving' ? 'text-primary' : 'text-muted-foreground'}
                >
                  {r.status === 'receiving' ? 'Agreed to receive' : 'Hasn’t agreed yet'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Members who haven’t agreed receive nothing. Each person decides for themselves.
          </p>
        </div>
      )}
    </div>
  );
}

/** Whose alerts the caller agrees to receive. Only the caller can change this. */
function ReceivingForm({ groupId, view }: { groupId: string; view: AccountabilityView }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={view.receiving.acceptAll}
          disabled={pending}
          onChange={(event) => {
            const value = event.target.checked;
            run(() => setAcceptAll(groupId, value));
          }}
        />
        <span className="font-medium">
          Accept alerts from anyone in this group who shares with me
          <span className="text-muted-foreground block text-xs font-normal">
            Otherwise you agree person by person below.
          </span>
        </span>
      </label>

      {view.senders.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nobody in this group shares alerts with you.
        </p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
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
                      ? 'shares alerts with you'
                      : 'would like you to receive their alerts'}
                  </span>
                </span>
                {s.status === 'needs_consent' ? (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      run(() => setSenderConsent(groupId, s.userId, true));
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
                  <span className="text-muted-foreground text-xs">Accepted via “anyone”</span>
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
      <p className="text-muted-foreground text-sm">
        Accountability is voluntary and personal. Admins cannot see or change these choices. Alerts
        never include the website, and nothing that happened before someone agreed is ever shared.
        Alert emails start when notifications launch.
      </p>
      <div className="space-y-3">
        <h3 className="font-semibold">Sharing your alerts</h3>
        <SharingForm groupId={groupId} view={view} others={others} />
      </div>
      <div className="space-y-3">
        <h3 className="font-semibold">Receiving others’ alerts</h3>
        <ReceivingForm groupId={groupId} view={view} />
      </div>
    </div>
  );
}
