/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

type Part = 'group' | 'protection' | 'blur' | 'sensitivity' | 'unchecked' | 'alerts';

/** Notes in the margins, each level with the control it explains (panel rows are fixed height). */
const NOTES: { part: Part; side: 'left' | 'right'; top: number; title: string; text: string }[] = [
  {
    part: 'group',
    side: 'left',
    top: 72,
    title: 'One group at a time',
    text: 'The browser follows the websites of the group you choose. With one group, it is chosen for you.',
  },
  {
    part: 'protection',
    side: 'left',
    top: 168,
    title: 'Protection you can see',
    text: 'On, starting, or out of date: the popup says plainly whether websites are being blocked.',
  },
  {
    part: 'blur',
    side: 'left',
    top: 264,
    title: 'Blurring on this device',
    text: 'Images and videos are checked by a model inside the extension. Nothing is uploaded.',
  },
  {
    part: 'sensitivity',
    side: 'right',
    top: 360,
    title: 'Three sensitivities',
    text: 'Relaxed, balanced or strict. Stricter blurs more, and blurs more safe images by mistake.',
  },
  {
    part: 'unchecked',
    side: 'right',
    top: 456,
    title: 'Blurred until checked',
    text: 'Media the model cannot check stays blurred by default; you can change that.',
  },
  {
    part: 'alerts',
    side: 'right',
    top: 552,
    title: 'Alerts are opt-in twice',
    text: 'You turn them on here, and only people who agreed can receive them.',
  },
];

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        on ? 'bg-slate-900' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform',
          on && 'translate-x-4',
        )}
      />
    </button>
  );
}

function Row({ part, active, children }: { part: Part; active: Part | null; children: ReactNode }) {
  return (
    <div
      data-part={part}
      className={cn(
        'flex h-[96px] flex-col justify-center gap-2 border-t border-slate-100 px-4 transition-shadow',
        active === part && 'relative z-10 rounded-md ring-2 ring-slate-900',
      )}
    >
      {children}
    </div>
  );
}

/** The extension's popup and settings in one panel, with what each part does. */
export function ExtensionPanel() {
  const [active, setActive] = useState<Part | null>(null);
  const [blur, setBlur] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const [level, setLevel] = useState('Balanced');
  const [unchecked, setUnchecked] = useState('Keep blurred');

  const note = (n: (typeof NOTES)[number]) => (
    <li
      key={n.part}
      tabIndex={0}
      onMouseEnter={() => {
        setActive(n.part);
      }}
      onMouseLeave={() => {
        setActive(null);
      }}
      onFocus={() => {
        setActive(n.part);
      }}
      onBlur={() => {
        setActive(null);
      }}
      style={{ ['--top' as string]: `${String(n.top)}px` }}
      className={cn(
        'rounded-md outline-offset-4 lg:absolute lg:top-[var(--top)] lg:w-[32ch]',
        n.side === 'left' ? 'lg:right-0 lg:text-right' : 'lg:left-0',
      )}
    >
      <p className={cn('text-lg font-medium', active === n.part && 'underline underline-offset-4')}>
        {n.title}
      </p>
      <p className="text-muted-foreground mt-1 text-[15px] leading-snug">{n.text}</p>
    </li>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
      <ul className="relative order-2 grid gap-6 sm:grid-cols-2 lg:order-none lg:col-span-4 lg:block lg:h-[704px]">
        {NOTES.filter((n) => n.side === 'left').map(note)}
      </ul>
      <div className="order-1 flex justify-center lg:order-none lg:col-span-4">
        <div
          data-ui
          className="[color-scheme:light] w-full max-w-[380px] overflow-hidden rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900"
        >
          <div className="flex h-[64px] items-center justify-between px-4">
            <span className="text-sm font-semibold tracking-wide">Resolve</span>
            <span className="text-slate-600">jonathan@example.org</span>
          </div>
          <Row part="group" active={active}>
            <label className="text-sm font-medium" htmlFor="demo-group">
              Active group
            </label>
            <select
              id="demo-group"
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[13px]"
              defaultValue="grace"
            >
              <option value="grace">Grace Fellowship</option>
              <option value="none">None selected</option>
            </select>
          </Row>
          <Row part="protection" active={active}>
            <p className="text-sm font-medium">Domain protection: on</p>
            <p className="text-slate-600">Rules updated 2 min ago · 14 websites blocked</p>
          </Row>
          <Row part="blur" active={active}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Blur sensitive images and videos</span>
              <Switch
                on={blur}
                label="Blur sensitive images and videos"
                onToggle={() => {
                  setBlur((v) => !v);
                }}
              />
            </div>
            <p className="text-slate-600">{blur ? 'On in this browser' : 'Off'}</p>
          </Row>
          <Row part="sensitivity" active={active}>
            <span className="text-sm font-medium">Sensitivity</span>
            <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-0.5">
              {['Relaxed', 'Balanced', 'Strict'].map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={level === l}
                  onClick={() => {
                    setLevel(l);
                  }}
                  className={cn(
                    'h-7 rounded text-[13px]',
                    level === l ? 'bg-white font-medium shadow-sm' : 'text-slate-600',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </Row>
          <Row part="unchecked" active={active}>
            <label className="text-sm font-medium" htmlFor="demo-unchecked">
              If media cannot be checked
            </label>
            <select
              id="demo-unchecked"
              value={unchecked}
              onChange={(e) => {
                setUnchecked(e.target.value);
              }}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[13px]"
            >
              <option>Keep blurred</option>
              <option>Show it</option>
            </select>
          </Row>
          <Row part="alerts" active={active}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                Alert my accountability partners about blocked visits
              </span>
              <Switch
                on={alerts}
                label="Alert my accountability partners about blocked visits"
                onToggle={() => {
                  setAlerts((v) => !v);
                }}
              />
            </div>
          </Row>
          <div className="flex h-[64px] items-center border-t border-slate-100 px-4 text-slate-600">
            Sharing: selected members (2 have agreed)
          </div>
        </div>
      </div>
      <ul className="relative order-3 grid gap-6 sm:grid-cols-2 lg:order-none lg:col-span-4 lg:block lg:h-[704px]">
        {NOTES.filter((n) => n.side === 'right').map(note)}
      </ul>
    </div>
  );
}
