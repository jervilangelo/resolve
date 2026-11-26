/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { send } from '@/lib/client';
import { formatRemaining } from '@/lib/focus-ui';
import { leaveTab } from '@/lib/leave-tab';
import { mount } from '@/lib/mount';

const primary =
  'rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-[background-color,transform] hover:bg-primary-pressed active:scale-[0.98]';
const secondary =
  'rounded-full border px-5 py-2.5 text-sm font-medium transition-[background-color,transform] hover:bg-muted active:scale-[0.98]';

/** Time left in the running session, from the background (null when unknown or ended). */
function useRemaining(): number | null {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => {
      send({ type: 'focus/get' }).then(
        (state) => {
          setEndsAt(state.session?.endsAt ?? null);
        },
        () => undefined,
      );
    };
    refresh();
    // Ended early, or a new session started, from the popup or settings.
    const onMessage = (message: unknown) => {
      if ((message as { type?: unknown } | null)?.type === 'focus/changed') refresh();
    };
    browser.runtime.onMessage.addListener(onMessage);
    const tick = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      browser.runtime.onMessage.removeListener(onMessage);
      clearInterval(tick);
    };
  }, []);
  return endsAt === null || endsAt <= now ? null : endsAt - now;
}

/** Shown instead of a website blocked by Focus Mode. It never names the site. */
function FocusPage() {
  // Reached by moving an open or blocked tab here: going back would only return to the site.
  const fromSwap = new URLSearchParams(window.location.search).has('from');
  const canGoBack = window.history.length > 1 && !fromSwap;
  const remaining = useRemaining();

  return (
    <main className="bg-background grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <img
          src="/brand/horizontal-compact-light.svg"
          alt="Resolve"
          width={140}
          height={34}
          className="rs-only-light mx-auto h-8 w-auto"
        />
        <img
          src="/brand/horizontal-compact-dark.svg"
          alt=""
          aria-hidden
          width={140}
          height={34}
          className="rs-only-dark mx-auto h-8 w-auto"
        />
        <h1 className="font-display mt-12 text-4xl leading-tight sm:text-5xl">Focus Mode is On</h1>
        <p
          className="text-muted-foreground mt-3 h-6 text-sm tabular-nums"
          aria-live="off"
          role="timer"
        >
          {remaining !== null && `${formatRemaining(remaining)} left`}
        </p>
        <p className="mt-6 text-lg">
          You committed this time to what matters. Don’t let a moment of distraction take it away.
        </p>
        <p className="font-display mt-8 text-2xl">Is this worth breaking your focus for?</p>
        <figure className="text-muted-foreground mt-6">
          <blockquote className="italic">
            “Redeeming the time, because the days are evil.”
          </blockquote>
          <figcaption className="mt-1 text-sm">— Ephesians 5:16 (KJV)</figcaption>
        </figure>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button type="button" className={primary} onClick={() => void leaveTab()}>
            Close this Tab
          </button>
          {canGoBack && (
            <button
              type="button"
              className={secondary}
              onClick={() => {
                window.history.back();
              }}
            >
              Go Back
            </button>
          )}
        </div>
        <p className="text-muted-foreground mt-10 text-sm">
          If this is an emergency, you can end Focus Mode from the Resolve extension.
        </p>
      </div>
    </main>
  );
}

mount(<FocusPage />);
