/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { useEffect, useState } from 'react';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Reports this browser's removal once, then drops the token from the address bar and history. */
export function RemovalReport() {
  const [reported, setReported] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('t');
    if (!token || !TOKEN.test(token)) return;
    window.history.replaceState(null, '', window.location.pathname);
    void fetch('/removed/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).finally(() => {
      setReported(true);
    });
  }, []);
  if (!reported) return null;
  return (
    <p role="status" className="bg-muted/60 mt-6 rounded-2xl px-5 py-4 leading-relaxed">
      This browser had removal alerts turned on, so accountability partners who agreed to them may
      receive a short email saying Resolve was removed from one of your browsers. It never mentions
      any website.
    </p>
  );
}
