/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { INACTIVITY_GRACE_HOURS } from '@resolve/contracts';
import { useEffect, useState } from 'react';
import { send } from '@/lib/client';
import type { InstallAlertsStatusMessage } from '@/lib/messages';

const INACTIVE_REASON: Record<
  Extract<InstallAlertsStatusMessage, { state: 'inactive' }>['reason'],
  string
> = {
  signedOut: 'sign in to turn this on',
  noGroup: 'choose an active group',
  offline: 'waiting to reach Resolve',
  unavailable: 'Resolve could not enrol this browser for your active group; choose it again',
};

function describe(status: InstallAlertsStatusMessage): string {
  if (status.state === 'off') return 'off';
  if (status.state === 'inactive') return `on, but inactive (${INACTIVE_REASON[status.reason]})`;
  const last = status.lastCheckInAt
    ? new Date(status.lastCheckInAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'not yet';
  return `on · last check-in ${last}`;
}

/**
 * Installation alerts (§7.4): partners who agreed can hear that Resolve was removed from this
 * browser or stopped checking in. Off by default; what is shared is chosen in the dashboard.
 */
export function InstallAlertsPanel() {
  const [status, setStatus] = useState<InstallAlertsStatusMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    send({ type: 'installAlerts/get' }).then(setStatus, () => {
      // Never leave the panel on "Loading…": show the default and say what went wrong.
      setStatus({ state: 'off' });
      setError('The current setting could not be loaded. Reopen this page to try again.');
    });
  }, []);

  async function toggle(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      setStatus(await send({ type: 'installAlerts/set', on }));
    } catch {
      setError('The setting could not be changed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <p className="text-muted-foreground text-sm">Loading…</p>;
  const on = status.state !== 'off';
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
        <label htmlFor="install-alerts-enabled" className="font-medium">
          Tell my partners if Resolve is removed or stops checking in on this browser
        </label>
        <input
          id="install-alerts-enabled"
          type="checkbox"
          className="size-4"
          checked={on}
          disabled={busy}
          onChange={(event) => void toggle(event.target.checked)}
        />
      </div>
      <p role="status" className="text-muted-foreground text-xs">
        Status: {describe(status)}
      </p>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Only partners in your active group who agreed to these alerts receive them, and only the
        kinds you share under Accountability in the dashboard. They see your display name, what
        happened and when; never a website.
      </p>
      <details className="text-muted-foreground text-xs">
        <summary className="text-foreground cursor-pointer font-medium">
          What triggers these alerts, and their limits
        </summary>
        <div className="mt-2 space-y-2">
          <p>
            <span className="text-foreground font-medium">Removed:</span> when Resolve is removed
            from this browser, the browser opens a Resolve page that reports it. If the browser is
            offline at that moment, nothing is reported then, and the check-in alert covers it
            later.
          </p>
          <p>
            <span className="text-foreground font-medium">Stopped checking in:</span> this browser
            checks in about once an hour while it is open. After {INACTIVITY_GRACE_HOURS} hours
            without a check-in, partners get one alert. A turned-off extension looks the same as a
            closed browser, a computer that is off or asleep, or no internet, so the alert says only
            when Resolve last checked in. It resets when check-ins resume.
          </p>
          <p>
            Turning this off, signing out or changing your active group stops both alerts for this
            browser right away.
          </p>
        </div>
      </details>
    </div>
  );
}
