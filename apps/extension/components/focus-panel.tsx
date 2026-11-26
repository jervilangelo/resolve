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
  FOCUS_MINUTES,
  type FocusOptional,
  MANDATORY_SERVICES,
  OPTIONAL_SERVICES,
  SERVICES,
} from '@/lib/focus';
import { EMERGENCY_PHRASE, formatRemaining } from '@/lib/focus-ui';
import type { ResponseMap } from '@/lib/messages';

type FocusState = ResponseMap['focus/get'];
type Step = 'none' | 'phrase' | 'confirm';

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

const btn =
  'inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium transition-[background-color,transform] active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100';
const primary = `${btn} bg-primary text-primary-foreground hover:bg-primary-pressed`;
const secondary = `${btn} border hover:bg-muted`;

function Pill({ on }: { on: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        on
          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {on ? 'On' : 'Off'}
    </span>
  );
}

/** Focus Mode: choose a duration, start, see the time left; ending early takes two steps. */
export function FocusPanel() {
  const ids = { title: useId(), custom: useId(), phrase: useId(), hint: useId(), confirm: useId() };
  const [state, setState] = useState<FocusState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const [step, setStep] = useState<Step>('none');
  const [phrase, setPhrase] = useState('');
  const [now, setNow] = useState(() => Date.now());

  async function refresh() {
    try {
      setState(await send({ type: 'focus/get' }));
    } catch {
      setError('Could not reach the Resolve background service.');
    }
  }

  useEffect(() => {
    void refresh();
    // The background announces changes made elsewhere (expiry, another window, settings page).
    const onMessage = (message: unknown) => {
      if ((message as { type?: unknown } | null)?.type === 'focus/changed') void refresh();
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => {
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  const session = state?.session ?? null;

  // Display only: the background owns the deadline and ends the session itself.
  useEffect(() => {
    if (!session) return;
    setNow(Date.now());
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= session.endsAt) void refresh();
    }, 1000);
    return () => {
      clearInterval(tick);
    };
  }, [session]);

  // A session that ended (by time or elsewhere) closes the early-exit steps.
  useEffect(() => {
    if (!session) {
      setStep('none');
      setPhrase('');
    }
  }, [session]);

  async function run(work: () => Promise<FocusState>) {
    setBusy(true);
    setError(null);
    try {
      setState(await work());
    } catch {
      setError('That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return error ? (
      <p role="alert" className="text-destructive text-xs">
        {error}
      </p>
    ) : (
      <div aria-hidden="true" className="bg-muted h-[212px] rounded-lg" />
    );
  }
  if (!state.supported) {
    return (
      <p className="text-muted-foreground text-xs">Focus Mode isn’t supported in this browser.</p>
    );
  }

  const { optional } = state.settings;
  const customMinutes = Number(customText);
  const customValid =
    Number.isInteger(customMinutes) &&
    customMinutes >= FOCUS_MINUTES.min &&
    customMinutes <= FOCUS_MINUTES.max;
  const minutes = custom ? customMinutes : state.settings.minutes;
  const focusPage = state.focusPage;

  function configure(nextOptional: FocusOptional, nextMinutes: number) {
    void run(() => send({ type: 'focus/configure', optional: nextOptional, minutes: nextMinutes }));
  }

  function start() {
    if (custom && !customValid) return;
    // Started inside the click (the prompt needs a user gesture) but not awaited first: the
    // prompt can close the popup, and the session must already be running.
    const asked =
      !focusPage && !import.meta.env.FIREFOX && !askedBefore()
        ? browser.permissions.request({ origins: ALL_FOCUS_PATTERNS }).catch(() => false)
        : null;
    void run(() => send({ type: 'focus/start', minutes, optional }));
    // The answer may come much later (or never); the running session shows meanwhile.
    void asked?.then((granted) => {
      if (granted) void refresh();
    });
  }

  const header = (on: boolean) => (
    <div className="flex items-center justify-between gap-2">
      <h2 id={ids.title} className="text-sm font-semibold">
        Focus Mode
      </h2>
      <Pill on={on} />
    </div>
  );

  const problem =
    state.enforcement === 'error' ? (
      <p role="alert" className="text-xs text-amber-800 dark:text-amber-300">
        {session
          ? 'Blocking could not be fully applied. Reopen this window to retry.'
          : 'Focus rules could not be fully removed. Reopen this window to retry.'}
      </p>
    ) : null;

  const closeSteps = () => {
    setStep('none');
    setPhrase('');
  };

  if (session) {
    const remaining = session.endsAt - now;
    const elapsed = 1 - Math.max(0, remaining) / (session.endsAt - session.startedAt);
    const blocked = MANDATORY_SERVICES.length + OPTIONAL_SERVICES.filter((s) => optional[s]).length;

    return (
      <section aria-labelledby={ids.title} className="flex min-h-[212px] flex-col gap-2.5">
        {header(true)}
        <div className={step === 'none' ? 'flex flex-1 flex-col justify-center gap-3' : ''}>
          <p
            role="timer"
            aria-label={`Time left: ${formatRemaining(remaining)}`}
            className={`text-center font-semibold tabular-nums ${step === 'none' ? 'text-4xl' : 'text-lg'}`}
          >
            {formatRemaining(remaining)}
          </p>

          {step === 'none' && (
            <div
              role="progressbar"
              aria-label="Focus session progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(elapsed * 100)}
              className="bg-muted h-1 overflow-hidden rounded-full"
            >
              <div
                className="bg-foreground h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                style={{ width: `${String(Math.min(100, elapsed * 100))}%` }}
              />
            </div>
          )}
        </div>
        {step === 'none' && (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                {String(blocked)} sites blocked · ends{' '}
                {new Date(session.endsAt).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                onClick={() => {
                  setStep('phrase');
                }}
              >
                End early
              </button>
            </div>
          </>
        )}

        {step === 'phrase' && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (phrase === EMERGENCY_PHRASE) setStep('confirm');
            }}
          >
            <label htmlFor={ids.phrase} className="block text-sm font-semibold">
              Is this an emergency?
            </label>
            <p id={ids.hint} className="text-muted-foreground text-xs">
              Type <span className="text-foreground font-medium">{EMERGENCY_PHRASE}</span>
            </p>
            <input
              id={ids.phrase}
              value={phrase}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={ids.hint}
              aria-invalid={phrase.length > 0 && phrase !== EMERGENCY_PHRASE}
              onChange={(e) => {
                setPhrase(e.target.value);
              }}
              onPaste={(e) => {
                e.preventDefault();
              }}
              className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
            />
            {phrase.length > 0 && phrase !== EMERGENCY_PHRASE && (
              <p className="text-muted-foreground text-[11px]">
                Type the phrase exactly, including capitals and the full stop.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className={secondary} onClick={closeSteps}>
                Keep focusing
              </button>
              <button type="submit" className={primary} disabled={phrase !== EMERGENCY_PHRASE}>
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 'confirm' && (
          <div role="alertdialog" aria-labelledby={ids.confirm} className="space-y-2.5">
            <p id={ids.confirm} className="text-sm font-semibold">
              Are you sure you want to end Focus Mode early?
            </p>
            <div className="grid gap-2">
              <button type="button" className={secondary} onClick={closeSteps}>
                No — Keep Focusing
              </button>
              <button
                type="button"
                className={primary}
                disabled={busy}
                onClick={() => {
                  void run(() => send({ type: 'focus/end' }));
                }}
              >
                Yes — End Focus Mode
              </button>
            </div>
          </div>
        )}
        {problem}
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby={ids.title} className="flex min-h-[212px] flex-col gap-2.5">
      {header(false)}
      <fieldset disabled={busy}>
        <legend className="text-muted-foreground mb-1.5 text-xs">Duration (minutes)</legend>
        <div className="flex flex-wrap gap-1">
          {FOCUS_MINUTES.presets.map((m) => {
            const selected = !custom && state.settings.minutes === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setCustom(false);
                  configure(optional, m);
                }}
                className={`h-7 min-w-9 rounded-full px-2 text-xs font-medium tabular-nums transition-colors ${
                  selected ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70'
                }`}
              >
                {m}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={custom}
            onClick={() => {
              setCustom(true);
              setCustomText(String(state.settings.minutes));
            }}
            className={`h-7 rounded-full px-2.5 text-xs font-medium transition-colors ${
              custom ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70'
            }`}
          >
            Custom
          </button>
        </div>
        {custom && (
          <div className="mt-1.5 flex items-center gap-2">
            <label htmlFor={ids.custom} className="sr-only">
              Custom duration in minutes
            </label>
            <input
              id={ids.custom}
              type="number"
              inputMode="numeric"
              min={FOCUS_MINUTES.min}
              max={FOCUS_MINUTES.max}
              value={customText}
              aria-invalid={!customValid}
              onChange={(e) => {
                setCustomText(e.target.value);
              }}
              className="border-input bg-background h-7 w-20 rounded-lg border px-2 text-sm tabular-nums"
            />
            <span
              className={`text-[11px] ${
                customValid ? 'text-muted-foreground' : 'text-amber-800 dark:text-amber-300'
              }`}
            >
              {String(FOCUS_MINUTES.min)}–{String(FOCUS_MINUTES.max)} minutes
            </span>
          </div>
        )}
      </fieldset>

      <fieldset disabled={busy}>
        <legend className="text-muted-foreground mb-1.5 text-xs">
          Blocks Facebook, Instagram, X, TikTok and Reddit. Also block:
        </legend>
        <div className="flex gap-1">
          {OPTIONAL_SERVICES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={optional[s]}
              aria-label={`Also block ${SERVICES[s].name}`}
              onClick={() => {
                configure(
                  { ...optional, [s]: !optional[s] },
                  custom && customValid ? customMinutes : state.settings.minutes,
                );
              }}
              className={`h-7 rounded-full border px-2.5 text-xs transition-colors ${
                optional[s] ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted'
              }`}
            >
              {SERVICES[s].name}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        className={`${primary} mt-auto h-9 w-full text-sm`}
        disabled={busy || (custom && !customValid)}
        onClick={start}
      >
        Start Focus · {custom && !customValid ? '—' : String(minutes)} min
      </button>
      {problem}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </section>
  );
}
