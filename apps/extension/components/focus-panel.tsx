/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { useEffect, useId, useState } from 'react';
import { browser } from 'wxt/browser';
import { send } from '@/lib/client';
import {
  ALL_FOCUS_PATTERNS,
  type FocusSettings,
  MANDATORY_SERVICES,
  OPTIONAL_SERVICES,
  type OptionalService,
  SERVICES,
} from '@/lib/focus';
import type { ResponseMap } from '@/lib/messages';

type FocusState = ResponseMap['focus/get'];

const ASKED_KEY = 'focusAccessAsked';

/** Site access is requested once automatically; afterwards only from the explicit link. */
function askedBefore(): boolean {
  try {
    if (localStorage.getItem(ASKED_KEY)) return true;
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // Storage unavailable: asking again is harmless.
  }
  return false;
}

function Switch({
  on,
  label,
  disabled,
  onChange,
  large = false,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onChange(!on);
      }}
      className={`relative shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        large ? 'h-7 w-12' : 'h-5 w-9'
      } ${on ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform ${
          large ? 'size-6' : 'size-4'
        } ${on ? (large ? 'translate-x-5' : 'translate-x-4') : ''}`}
      />
    </button>
  );
}

/** Focus Mode: one switch, five fixed sites, three optional ones. Everything stays local. */
export function FocusPanel() {
  const ids = { title: useId(), extra: useId() };
  const [state, setState] = useState<FocusState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    send({ type: 'focus/get' }).then(setState, () => {
      setError('Could not reach the Resolve background service.');
    });
  }, []);

  async function save(next: FocusSettings, askForPage: boolean) {
    setBusy(true);
    setError(null);
    // Started inside the click (the browser shows its prompt only for a user gesture) but not
    // awaited first: the prompt can close the popup, and the setting must already be saved. A
    // grant later switches the rule to the Focus page through the background's reconcile.
    const asked =
      askForPage && !import.meta.env.FIREFOX
        ? browser.permissions.request({ origins: ALL_FOCUS_PATTERNS }).catch(() => false)
        : null;
    try {
      setState(await send({ type: 'focus/set', settings: next }));
      if (asked && (await asked)) setState(await send({ type: 'focus/get' }));
    } catch {
      setError('Focus Mode could not be changed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return error ? (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    ) : (
      <div aria-hidden="true" className="bg-muted h-40 rounded-lg" />
    );
  }

  if (!state.supported) {
    return (
      <p className="text-muted-foreground text-sm">Focus Mode isn’t supported in this browser.</p>
    );
  }

  const { settings, enforcement } = state;
  const on = settings.enabled;

  return (
    <section aria-labelledby={ids.title} className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={ids.title} className="text-sm font-semibold">
            Focus Mode
          </h2>
          <p className="text-muted-foreground text-xs">
            Stay focused by temporarily blocking distracting websites.
          </p>
        </div>
        <Switch
          large
          on={on}
          label="Focus Mode"
          disabled={busy}
          onChange={(next) => {
            void save({ ...settings, enabled: next }, next && !state.focusPage && !askedBefore());
          }}
        />
      </div>

      <p
        role="status"
        className={`rounded-lg px-3 py-2 text-sm font-medium ${
          enforcement === 'error'
            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
            : on
              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {enforcement === 'error'
          ? on
            ? 'Focus Mode could not be fully applied. Turn it off and on again.'
            : 'Focus Mode could not be fully turned off. Turn it on and off again.'
          : on
            ? 'Focus Mode is On'
            : 'Focus Mode is Off'}
      </p>

      <div>
        <p className="text-muted-foreground mb-1.5 text-xs">
          {on ? 'Blocked now' : 'Blocked when on'}
        </p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Always blocked in Focus Mode">
          {MANDATORY_SERVICES.map((s) => (
            <li key={s} className="bg-muted rounded-full px-2.5 py-1 text-xs font-medium">
              {SERVICES[s].name}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p id={ids.extra} className="text-muted-foreground mb-1.5 text-xs">
          Additional restrictions
        </p>
        <ul aria-labelledby={ids.extra} className="divide-y rounded-lg border">
          {OPTIONAL_SERVICES.map((s: OptionalService) => (
            <li key={s} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>{SERVICES[s].name}</span>
              <Switch
                on={settings.optional[s]}
                label={`Also block ${SERVICES[s].name}`}
                disabled={busy}
                onChange={(next) => {
                  void save({ ...settings, optional: { ...settings.optional, [s]: next } }, false);
                }}
              />
            </li>
          ))}
        </ul>
      </div>

      {on && enforcement === 'on' && !state.focusPage && (
        <p className="text-muted-foreground text-xs">
          Blocked sites show your browser’s standard message.{' '}
          {!import.meta.env.FIREFOX && (
            <button
              type="button"
              className="text-foreground underline"
              onClick={() => {
                void save(settings, true);
              }}
            >
              Show Resolve’s Focus page instead
            </button>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </section>
  );
}
