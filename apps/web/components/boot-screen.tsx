/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { useEffect } from 'react';

const KEY = 'rs-booted';

/**
 * Runs before first paint (inline in <head>): only a first visit in this browser session shows
 * the boot screen, and only when script runs, so the screen can always be taken away again.
 */
export const BOOT_SCRIPT = `try{if(!sessionStorage.getItem('${KEY}'))document.documentElement.classList.add('rs-booting')}catch(e){}`;

/** Branded cover while the first page hydrates; fades out as soon as the app is interactive. */
export function BootScreen() {
  useEffect(() => {
    const root = document.documentElement;
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      // Private mode: the screen still leaves; it may show again next visit.
    }
    if (!root.classList.contains('rs-booting')) return;
    root.classList.replace('rs-booting', 'rs-booted');
    const timer = setTimeout(() => {
      root.classList.remove('rs-booted');
    }, 320);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="rs-boot" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- must render before hydration */}
      <img
        src="/brand/horizontal-compact-light.svg"
        alt=""
        width={200}
        height={48}
        className="rs-boot-mark rs-only-light"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- must render before hydration */}
      <img
        src="/brand/horizontal-compact-dark.svg"
        alt=""
        width={200}
        height={48}
        className="rs-boot-mark rs-only-dark"
      />
    </div>
  );
}
