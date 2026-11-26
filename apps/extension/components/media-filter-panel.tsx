/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { send } from '@/lib/client';
import type { Sensitivity } from '@/lib/media/policy';
import type { FilterSettings } from '@/lib/media/protocol';
import { SITE_ACCESS } from '@/lib/media/registration';
import type { FilterStateMessage } from '@/lib/messages';

const SENSITIVITY_TEXT: Record<Sensitivity, { label: string; detail: string }> = {
  strict: {
    label: 'Strict',
    detail: 'Also blurs suggestive images such as swimwear. Blurs more safe images by mistake.',
  },
  balanced: {
    label: 'Balanced',
    detail: 'Blurs explicit images and strongly suggestive ones. Recommended.',
  },
  relaxed: {
    label: 'Relaxed',
    detail: 'Blurs only clearly explicit images. More sensitive images may get through.',
  },
};

export const STATUS_TEXT: Record<FilterStateMessage['status'], string> = {
  off: 'Off',
  on: 'On',
  needsAccess: 'Needs site access',
  unsupported: 'Not supported in this browser yet',
};

/** Compact state for the popup. */
export function MediaFilterLine() {
  const [state, setState] = useState<FilterStateMessage | null>(null);
  useEffect(() => {
    send({ type: 'filter/get' }).then(setState, () => undefined);
  }, []);
  if (!state) return null;
  return (
    <p
      role={state.status === 'needsAccess' ? 'alert' : undefined}
      className={
        state.status === 'needsAccess'
          ? 'text-destructive text-xs'
          : 'text-muted-foreground text-xs'
      }
    >
      Media blurring: {STATUS_TEXT[state.status].toLowerCase()}
      {state.status === 'needsAccess' && ' (open Settings to fix)'}
    </p>
  );
}

/** Options-page controls for the on-device media filter. */
export function MediaFilterPanel() {
  const [state, setState] = useState<FilterStateMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    send({ type: 'filter/get' }).then(setState, () => {
      setError('Could not reach the Resolve background service.');
    });
  }, []);

  async function save(settings: FilterSettings) {
    setBusy(true);
    setError(null);
    try {
      setState(await send({ type: 'filter/set', settings }));
    } catch {
      setError('The setting could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  /** The browser shows its own prompt; it must be requested directly from the click. */
  async function turnOn(settings: FilterSettings) {
    let granted = false;
    try {
      granted = await browser.permissions.request(SITE_ACCESS);
    } catch {
      granted = false;
    }
    if (!granted) {
      setError('Media blurring needs access to the pages you visit. It stays off.');
      return;
    }
    await save({ ...settings, enabled: true });
  }

  if (!state) {
    return error ? (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    ) : (
      <p className="text-muted-foreground text-sm">Loading…</p>
    );
  }
  const { settings, status } = state;
  if (status === 'unsupported') {
    return <p className="text-muted-foreground text-sm">{STATUS_TEXT.unsupported}.</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
        <label htmlFor="media-filter-enabled" className="font-medium">
          Blur sensitive images and videos
        </label>
        <input
          id="media-filter-enabled"
          type="checkbox"
          className="size-4"
          checked={settings.enabled}
          disabled={busy}
          onChange={(event) => {
            if (event.target.checked) void turnOn(settings);
            else void save({ ...settings, enabled: false });
          }}
        />
      </div>
      <p role="status" className="text-muted-foreground text-xs">
        Status: {STATUS_TEXT[status]}
      </p>
      {status === 'needsAccess' && (
        <div role="alert" className="text-destructive space-y-1 text-xs">
          <p>Site access was withdrawn in the browser, so nothing is being blurred.</p>
          <button
            type="button"
            className="underline"
            disabled={busy}
            onClick={() => void turnOn(settings)}
          >
            Grant access again
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}

      {settings.enabled && (
        <>
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="font-medium">Sensitivity</legend>
            {(Object.keys(SENSITIVITY_TEXT) as Sensitivity[]).map((level) => (
              <label key={level} className="flex gap-2">
                <input
                  type="radio"
                  name="sensitivity"
                  className="mt-1"
                  checked={settings.sensitivity === level}
                  onChange={() => void save({ ...settings, sensitivity: level })}
                />
                <span className="font-medium">
                  {SENSITIVITY_TEXT[level].label}
                  <span className="text-muted-foreground block text-xs font-normal">
                    {SENSITIVITY_TEXT[level].detail}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2" disabled={busy}>
            <legend className="font-medium">Media that can’t be checked</legend>
            <p className="text-muted-foreground text-xs">
              Some videos (for example protected streaming video) and images do not let extensions
              read their pixels.
            </p>
            {(
              [
                ['blur', 'Keep it blurred (safer)'],
                ['show', 'Show it'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="unverifiable"
                  checked={settings.unverifiable === value}
                  onChange={() => void save({ ...settings, unverifiable: value })}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        </>
      )}

      <p className="text-muted-foreground text-xs">
        Checked by an AI model on this device. Nothing is uploaded, stored or shared.
      </p>
      <details className="text-muted-foreground text-xs">
        <summary className="text-foreground cursor-pointer font-medium">
          How blurring works, and its limits
        </summary>
        <p className="mt-2">
          The model makes mistakes: some sensitive media will not be blurred, and some safe media
          will be. Images drawn as page backgrounds or on canvases are not checked, and video is
          checked a few times per second at most. Media starts blurred and appears once checked, so
          pages may look blurred for a moment. Changes apply to pages you open or reload.
        </p>
      </details>
    </div>
  );
}
