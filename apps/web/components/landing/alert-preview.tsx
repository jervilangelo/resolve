/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

type Mode = 'PRIVATE' | 'SELECTED' | 'EVERYONE';

/** A sample group: who has agreed to receive Jonathan's alerts. */
const MEMBERS = [
  { name: 'Daniel', agreed: true },
  { name: 'Marcus', agreed: true },
  { name: 'Pastor Ben', agreed: false },
] as const;

const MODES: { value: Mode; label: string }[] = [
  { value: 'PRIVATE', label: 'Private' },
  { value: 'SELECTED', label: 'Selected' },
  { value: 'EVERYONE', label: 'Everyone' },
];

/**
 * The hero's working fragment: the real sharing control and the real alert email (the same text
 * the delivery worker sends), so a visitor sees exactly who would receive what. It reads its
 * own state: the readout counts recipients and the websites named, which is always zero.
 */
export function AlertPreview() {
  const id = useId();
  const [mode, setMode] = useState<Mode>('SELECTED');
  const [chosen, setChosen] = useState<Set<string>>(new Set(['Daniel', 'Pastor Ben']));

  const inScope = MEMBERS.filter((m) =>
    mode === 'EVERYONE' ? true : mode === 'SELECTED' ? chosen.has(m.name) : false,
  );
  const receiving = inScope.filter((m) => m.agreed);
  const waiting = inScope.filter((m) => !m.agreed);

  return (
    <div
      data-ui
      className="[color-scheme:light] w-full max-w-[440px] rounded-xl bg-white text-[13px] text-slate-900"
    >
      <div className="space-y-3 p-4">
        <p id={`${id}-q`} className="text-sm font-semibold">
          Who may receive alerts about you
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${id}-q`}
          className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1"
        >
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              onClick={() => {
                setMode(m.value);
              }}
              className={cn(
                'h-9 rounded-md text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-slate-900',
                mode === m.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {MEMBERS.map((m) => {
            const checked = mode === 'EVERYONE' || (mode === 'SELECTED' && chosen.has(m.name));
            return (
              <li key={m.name} className="flex h-11 items-center gap-3 px-3">
                <input
                  type="checkbox"
                  aria-label={`Share with ${m.name}`}
                  checked={checked}
                  disabled={mode !== 'SELECTED'}
                  onChange={() => {
                    setChosen((prev) => {
                      const next = new Set(prev);
                      if (next.has(m.name)) next.delete(m.name);
                      else next.add(m.name);
                      return next;
                    });
                  }}
                  className="size-4 accent-slate-900 disabled:opacity-60"
                />
                <span className="flex-1 font-medium">{m.name}</span>
                <span className={m.agreed ? 'text-emerald-800' : 'text-slate-600'}>
                  {m.agreed ? 'Agreed to receive' : 'Has not agreed'}
                </span>
              </li>
            );
          })}
        </ul>
        <p aria-live="polite" className="text-slate-600 tabular-nums">
          Reaches {String(receiving.length)} {receiving.length === 1 ? 'person' : 'people'} · names
          0 websites
        </p>
      </div>

      <div className="rounded-b-xl border-t border-slate-200 bg-slate-50 p-4">
        {receiving.length === 0 ? (
          <div className="flex min-h-[188px] flex-col justify-center">
            <p className="text-sm font-semibold">Nothing is sent.</p>
            <p className="mt-1 text-slate-600">
              {mode === 'PRIVATE'
                ? 'Private is the default: no one receives alerts about you.'
                : waiting.length > 0
                  ? 'The people you chose have not agreed yet, so they receive nothing.'
                  : 'Choose at least one member who has agreed.'}
            </p>
          </div>
        ) : (
          <div className="min-h-[188px] space-y-2">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-slate-600">
              <dt>From</dt>
              <dd className="text-slate-900">Resolve &lt;no-reply@getresolved.site&gt;</dd>
              <dt>To</dt>
              <dd className="text-slate-900">{receiving.map((m) => m.name).join(', ')}</dd>
              <dt>Subject</dt>
              <dd className="font-medium text-slate-900">Accountability alert from Resolve</dd>
            </dl>
            <p className="pt-1">
              Jonathan triggered a non-negotiable website restriction in Grace Fellowship.
            </p>
            <p>
              Resolve never shares which website it was. This alert comes from the Resolve browser
              extension and is not proof of intent, so please reach out with grace and care.
            </p>
            {waiting.length > 0 && (
              <p className="text-slate-600">
                {waiting.map((m) => m.name).join(', ')} receives nothing until they agree.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
