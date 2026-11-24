/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { useEffect, useState } from 'react';
import { send } from '@/lib/client';
import type { AccountState } from '@/lib/messages';
import { useAlertsGranted } from './alerts-panel';

const buttonClass =
  'w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60 bg-primary text-primary-foreground hover:bg-primary-pressed';
const secondaryClass =
  'w-full rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60 hover:bg-muted';

function ago(timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)} min ago`;
  return `${String(Math.round(minutes / 60))} h ago`;
}

function ProtectionLine({
  protection,
  onRetry,
  busy,
}: {
  protection: AccountState extends infer S
    ? S extends { state: 'signedIn'; protection: infer P }
      ? P
      : never
    : never;
  onRetry: () => void;
  busy: boolean;
}) {
  if (protection.state === 'off') return null;
  if (protection.state === 'starting') {
    return <p className="text-muted-foreground text-xs">Domain protection: turning on…</p>;
  }
  if (protection.state === 'error') {
    return (
      <div role="alert" className="text-destructive space-y-1 text-xs">
        <p>Domain protection could not be turned on. Websites are not being blocked.</p>
        <button type="button" className="underline" disabled={busy} onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  const when = protection.syncedAt ? ` · rules updated ${ago(protection.syncedAt)}` : '';
  if (protection.state === 'idle') {
    return (
      <p className="text-muted-foreground text-xs">
        Domain protection: no websites blocked yet. It starts automatically when your group adds
        some{when}.
      </p>
    );
  }
  return protection.state === 'stale' ? (
    <p role="status" className="text-destructive text-xs">
      Domain protection: on, but rules could not be updated recently{when}. Check your connection.
    </p>
  ) : (
    <p className="text-muted-foreground text-xs">Domain protection: on{when}</p>
  );
}

type Sharing = Extract<AccountState, { state: 'signedIn' }>['sharing'];

/**
 * The user's own accountability sharing in the active group, kept distinct from protection state
 * (MASTER_PLAN §8.4), with a warning when alerts are shared but this browser does not report them.
 */
function SharingLine({ sharing }: { sharing: NonNullable<Sharing> }) {
  const [alertsOn] = useAlertsGranted();
  if (sharing.mode === 'PRIVATE') {
    return <p className="text-muted-foreground text-xs">Accountability sharing: private</p>;
  }
  const who = sharing.mode === 'EVERYONE' ? 'everyone in the group' : 'selected members';
  const agreed =
    sharing.receiving === 1 ? '1 has agreed' : `${String(sharing.receiving)} have agreed`;
  return (
    <div className="space-y-1 text-xs">
      <p className="text-muted-foreground">
        Accountability sharing: {who} ({agreed})
      </p>
      {alertsOn === false && (
        <p role="alert" className="text-destructive">
          Blocked visits in this browser are not reported. Turn on accountability alerts in
          Settings.
        </p>
      )}
    </div>
  );
}

/** Account and active-group controls; all state comes from the background worker. */
export function AccountPanel() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    send({ type: 'account/get' }).then(setAccount, () => {
      setAccount({ state: 'signedOut', error: 'Could not reach the Resolve background service.' });
    });
  }, []);

  async function run(action: () => Promise<AccountState>) {
    setBusy(true);
    try {
      setAccount(await action());
    } catch {
      // The worker may have restarted mid-request after committing the action: re-read state.
      const fallback = 'Something went wrong. Please try again.';
      try {
        const current = await send({ type: 'account/get' });
        setAccount(current.state === 'unconfigured' ? current : { ...current, error: fallback });
      } catch {
        setAccount({ state: 'signedOut', error: fallback });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!account) return <p className="text-muted-foreground text-sm">Loading account…</p>;

  if (account.state === 'unconfigured') {
    return (
      <p className="text-muted-foreground text-sm">
        Sign-in is not available in this build of the extension.
      </p>
    );
  }

  const error = 'error' in account && account.error && (
    <p role="alert" className="text-destructive text-sm">
      {account.error}
    </p>
  );

  if (account.state === 'signedOut') {
    return (
      <div className="space-y-3">
        <p className="text-sm">Sign in to choose the group this browser protects for.</p>
        {error}
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={() => void run(() => send({ type: 'account/signIn' }))}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Signed in{account.email ? ` as ${account.email}` : ''}
      </p>
      {!account.groupsLoaded ? null : account.groups.length === 0 ? (
        <p className="text-sm">
          You are not in a group yet. Create or join one on the{' '}
          <a href={account.dashboardUrl} target="_blank" rel="noreferrer" className="underline">
            dashboard
          </a>
          .
        </p>
      ) : (
        <div className="space-y-1">
          <label htmlFor="active-group" className="text-sm font-medium">
            Active group
          </label>
          <select
            id="active-group"
            className="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
            value={account.activeGroupId ?? ''}
            disabled={busy}
            onChange={(e) => {
              const groupId = e.target.value || null;
              void run(() => send({ type: 'group/setActive', groupId }));
            }}
          >
            <option value="">None selected</option>
            {account.groups.map((group) => (
              <option key={group.groupId} value={group.groupId}>
                {group.name}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            This browser follows one group&apos;s protection settings at a time.
          </p>
        </div>
      )}
      {account.activeGroupId && (
        <ProtectionLine
          protection={account.protection}
          busy={busy}
          onRetry={() => void run(() => send({ type: 'protection/retry' }))}
        />
      )}
      {account.activeGroupId && account.sharing && <SharingLine sharing={account.sharing} />}
      {error}
      <div className="flex gap-2">
        <a
          href={account.dashboardUrl}
          target="_blank"
          rel="noreferrer"
          className={`${secondaryClass} text-center`}
        >
          Dashboard
        </a>
        <button
          type="button"
          className={secondaryClass}
          disabled={busy}
          onClick={() => void run(() => send({ type: 'account/signOut' }))}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
