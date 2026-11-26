/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { send } from '@/lib/client';
import type { AlertsStatus } from '@/lib/messages';

/**
 * Alerts for blocked visits (Trigger A). Reporting needs the optional `webNavigation` permission,
 * which the browser describes broadly ("read your browsing history"), so it is only requested
 * when the person turns this on, and can be turned off here or in the browser at any time.
 */
const ALERTS = { permissions: ['webNavigation' as const] };

/** Only builds that declare the optional permission can turn alerts on (not Firefox yet). */
function supported(): boolean {
  return browser.runtime.getManifest().optional_permissions?.includes('webNavigation') ?? false;
}

export function useAlertsGranted(): [boolean | null, (value: boolean) => void] {
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    if (!supported()) return;
    const refresh = () => {
      browser.permissions.contains(ALERTS).then(setGranted, () => {
        setGranted(false);
      });
    };
    refresh();
    // The person can also change it in the browser's own settings while this page is open.
    browser.permissions.onAdded.addListener(refresh);
    browser.permissions.onRemoved.addListener(refresh);
    return () => {
      browser.permissions.onAdded.removeListener(refresh);
      browser.permissions.onRemoved.removeListener(refresh);
    };
  }, []);
  return [granted, setGranted];
}

const INACTIVE_REASON: Record<Extract<AlertsStatus, { state: 'inactive' }>['reason'], string> = {
  signedOut: 'sign in to report',
  noGroup: 'choose an active group',
  noRestrictions: 'your group has no non-negotiable websites',
};

export function describe(status: AlertsStatus): string {
  if (status.state === 'inactive') return `on, but inactive (${INACTIVE_REASON[status.reason]})`;
  if (status.state === 'on') return 'on (sent only if your sharing is not Private)';
  return status.state === 'off' ? 'off' : 'not supported in this browser';
}

/** The background's view of whether a report could actually be sent right now. */
export function useAlertsStatus(granted: boolean | null): AlertsStatus | null {
  const [status, setStatus] = useState<AlertsStatus | null>(null);
  useEffect(() => {
    send({ type: 'alerts/get' }).then(setStatus, () => {
      setStatus(null);
    });
  }, [granted]);
  return status;
}

/** Compact state for the popup. */
export function AlertsLine() {
  const [granted] = useAlertsGranted();
  const status = useAlertsStatus(granted);
  if (!status || status.state === 'unsupported') return null;
  return (
    <p className="text-muted-foreground text-xs">Alerts for blocked visits: {describe(status)}</p>
  );
}

export function AlertsPanel() {
  const [granted, setGranted] = useAlertsGranted();
  const status = useAlertsStatus(granted);
  const [error, setError] = useState<string | null>(null);

  if (!supported()) {
    return <p className="text-muted-foreground text-sm">Not supported in this browser yet.</p>;
  }
  if (granted === null) return <p className="text-muted-foreground text-sm">Loading…</p>;

  async function toggle(on: boolean) {
    setError(null);
    try {
      // The browser shows its own prompt; it must be requested directly from the click.
      const ok = on
        ? await browser.permissions.request(ALERTS)
        : await browser.permissions.remove(ALERTS);
      if (on && !ok) setError('Alerts stay off: the browser permission was not granted.');
      setGranted(on ? ok : !ok);
    } catch {
      setError('The setting could not be changed. Please try again.');
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
        <label htmlFor="alerts-enabled" className="font-medium">
          Alert my accountability partners about blocked visits
        </label>
        <input
          id="alerts-enabled"
          type="checkbox"
          className="size-4"
          checked={granted}
          onChange={(event) => void toggle(event.target.checked)}
        />
      </div>
      {status && granted && (
        <p role="status" className="text-muted-foreground text-xs">
          Status: {describe(status)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Sends a short alert, never naming the website, to the people you chose in the dashboard who
        agreed. Nothing is sent while your sharing is Private.
      </p>
      <details className="text-muted-foreground text-xs">
        <summary className="text-foreground cursor-pointer font-medium">
          What Resolve sees, and when alerts are skipped
        </summary>
        <div className="mt-2 space-y-2">
          <p>
            The browser describes this permission as reading your browsing history. Resolve sees
            each page address briefly, on this device only, to recognise blocked visits; it stores
            and sends none of them. An alert is reported by this extension and is not proof of
            intent.
          </p>
          <p>
            To avoid false alerts, Resolve skips blocks a page or ad caused, restored and reloaded
            tabs, and repeats within ten minutes.
          </p>
        </div>
      </details>
    </div>
  );
}
