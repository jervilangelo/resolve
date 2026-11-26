/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { useState } from 'react';
import { DEFAULT_QUOTE, QUOTATIONS, REFLECTIONS, pickIndex } from '@/lib/encouragement';
import { leaveTab } from '@/lib/leave-tab';
import { mount } from '@/lib/mount';

const LAST_KEY = 'blockedPageLast';

/** A fresh reflection and quotation on each visit, not the same as last time (stored locally). */
function choose(): { reflection: string; quote: (typeof QUOTATIONS)[number] } {
  const last: { r: number | null; q: number | null } = { r: null, q: null };
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') as Record<string, unknown>;
    if (Number.isInteger(stored.r)) last.r = stored.r as number;
    if (Number.isInteger(stored.q)) last.q = stored.q as number;
  } catch {
    // No memory of the last visit: any choice is fine.
  }
  const r = pickIndex(REFLECTIONS.length, last.r);
  const q = pickIndex(QUOTATIONS.length, last.q);
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ r, q }));
  } catch {
    // Storage unavailable: a repeat is harmless.
  }
  return {
    reflection: REFLECTIONS[r] ?? REFLECTIONS[0] ?? '',
    quote: QUOTATIONS[q] ?? DEFAULT_QUOTE,
  };
}

function ShieldMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6z" />
      <path d="M9.5 12.5 11 14l3.5-3.5" />
    </svg>
  );
}

/**
 * Shown after the browser blocked a website restricted by the user's accountability group. The
 * site itself never loaded; this page never names it and offers no way past the restriction.
 */
function BlockedPage() {
  const [{ reflection, quote }] = useState(choose);
  return (
    <main className="bg-background grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
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

        <div className="bg-muted text-foreground mx-auto mt-12 grid size-14 place-items-center rounded-2xl">
          <ShieldMark />
        </div>
        <h1 className="text-muted-foreground mt-5 text-sm font-semibold tracking-wide">
          Access Blocked
        </h1>
        <p className="font-display mt-4 text-4xl leading-tight sm:text-5xl">{reflection}</p>
        <p className="text-muted-foreground mx-auto mt-5 max-w-md text-lg">
          You made a commitment to guard your heart. Before you go any further, remember who you are
          living for.
        </p>

        <figure className="bg-muted/60 mx-auto mt-10 max-w-lg rounded-2xl px-6 py-5 text-left">
          <blockquote className="font-display text-lg leading-snug">“{quote.text}”</blockquote>
          <figcaption className="text-muted-foreground mt-3 text-sm">
            — {quote.source}
            {quote.work && (
              <>
                , <cite>{quote.work}</cite>
              </>
            )}
          </figcaption>
        </figure>

        <button
          type="button"
          onClick={() => void leaveTab()}
          className="bg-primary text-primary-foreground hover:bg-primary-pressed mt-10 rounded-full px-7 py-3 text-sm font-medium transition-[background-color,transform] active:scale-[0.98]"
        >
          Choose to Walk Away
        </button>
        <p className="text-muted-foreground mt-6 text-xs">
          This website is restricted by your accountability group.
        </p>
      </div>
    </main>
  );
}

mount(<BlockedPage />);
