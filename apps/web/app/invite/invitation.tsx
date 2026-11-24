/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { type PreviewResult, acceptInvitation, previewInvitation } from './actions';

/** Survives the sign-in round trip in this tab only; cleared once used. */
const STORAGE_KEY = 'rs_pending_invitation';

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(token: string | null) {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the invitee simply opens the link again after signing in.
  }
}

type View = { kind: 'loading' } | { kind: 'invalid' } | (PreviewResult & { kind: 'ready' });

export function Invitation() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const token = useRef<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    const fromLink = window.location.hash.slice(1);
    if (fromLink) {
      store(fromLink);
      // Drop the token from the address bar and history.
      window.history.replaceState(null, '', '/invite');
    }
    token.current = fromLink || readStored();

    async function load(current: string | null) {
      if (!current) {
        setView({ kind: 'invalid' });
        return;
      }
      try {
        const result = await previewInvitation(current);
        if (result.status === 'signin') {
          // Full navigation: the login route redirects off-site to Cognito managed login.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign('/auth/login?returnTo=%2Finvite');
          return;
        }
        if (result.status === 'invalid') store(null);
        setView(result.status === 'ok' ? { kind: 'ready', ...result } : { kind: 'invalid' });
      } catch {
        setView({ kind: 'invalid' });
      }
    }
    void load(token.current);
  }, []);

  if (view.kind === 'loading') {
    return <p className="text-muted-foreground">Checking your invitation…</p>;
  }

  if (view.kind === 'invalid' || view.status !== 'ok') {
    return (
      <div>
        <h1 className="font-display text-3xl">This invitation is not valid</h1>
        <p className="text-muted-foreground mt-4">
          It may have expired, been used already, or been revoked. Ask the group admin for a new
          link.
        </p>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/dashboard/groups">Go to your groups</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-muted-foreground text-sm">You have been invited to join</p>
      <h1 className="font-display mt-2 text-3xl">{view.groupName}</h1>
      <p className="text-muted-foreground mt-6 text-sm">
        Joining does not share anything about you with the group. Your accountability sharing stays
        private until you choose otherwise.
      </p>
      <div className="mt-8 space-y-3">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            const current = token.current;
            store(null);
            start(async () => {
              const result = await acceptInvitation(current);
              // Reached only on failure; success redirects to the group.
              setError(result.error);
            });
          }}
        >
          {pending ? 'Joining…' : 'Join group'}
        </Button>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
