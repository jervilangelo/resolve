/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { useEffect, useState } from 'react';
import { send } from '@/lib/client';
import type { Status } from '@/lib/messages';
import { FEATURE_LABELS } from '@/lib/status';

type State = { kind: 'loading' } | { kind: 'ready'; status: Status } | { kind: 'error' };

/** Live feature state reported by the background worker; never assumes protection is on. */
export function FeatureStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    send({ type: 'status/get' }).then(
      (status) => {
        setState({ kind: 'ready', status });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
  }, []);

  if (state.kind === 'loading') return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (state.kind === 'error') {
    return (
      <p role="alert" className="text-destructive text-sm">
        Could not reach the Resolve background service. Try reopening this window.
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y rounded-md border" aria-label="Protection features">
        {state.status.features.map((feature) => (
          <li
            key={feature.id}
            className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
          >
            <span>{FEATURE_LABELS[feature.id]}</span>
            <span
              className={feature.available ? 'font-medium text-primary' : 'text-muted-foreground'}
            >
              {feature.available ? 'Available' : 'Not yet available'}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-3 text-xs">Version {state.status.version}</p>
    </div>
  );
}
