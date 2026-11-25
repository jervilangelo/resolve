/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { useEffect } from 'react';

/**
 * Section entrances: marks the page as scripted, then reveals each `[data-reveal]` element once
 * as it scrolls into view. Without script (or with reduced motion) everything is simply shown.
 */
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    // Already on screen at load: shown at once (before hiding anything), without a flash.
    for (const item of items) {
      const box = item.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) item.dataset.shown = '';
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = '';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    root.classList.add('rs-js');
    for (const item of items) if (!('shown' in item.dataset)) observer.observe(item);
    return () => {
      observer.disconnect();
      root.classList.remove('rs-js');
    };
  }, []);
  return null;
}
