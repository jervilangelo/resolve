/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

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

function useAlertsGranted(): [boolean | null, (value: boolean) => void] {
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

/** Compact state for the popup. */
export function AlertsLine() {
  const [granted] = useAlertsGranted();
  if (granted === null) return null;
  return (
    <p className="text-muted-foreground text-xs">
      Alerts for blocked visits: {granted ? 'on (sent only if your sharing is not Private)' : 'off'}
    </p>
  );
}

export function AlertsPanel() {
  const [granted, setGranted] = useAlertsGranted();
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
      <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
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
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <div className="text-muted-foreground space-y-2 text-xs">
        <p>
          When you open a page your group lists as non-negotiable and Resolve blocks it, the members
          you chose under Accountability in the dashboard (and who agreed) receive a short alert. It
          never says which website it was. Nothing is sent while your sharing is Private.
        </p>
        <p>
          The browser describes this permission as reading your browsing history. Resolve only
          checks pages it blocked, on this device, and keeps no history. An alert is reported by
          this extension and is not proof of intent.
        </p>
      </div>
    </div>
  );
}
