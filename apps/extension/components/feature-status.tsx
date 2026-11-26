/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { useEffect, useState } from 'react';
import { send } from '@/lib/client';
import type { AccountState, FeatureId, FilterStateMessage, Status } from '@/lib/messages';
import { FEATURE_LABELS } from '@/lib/status';
import { describe, useAlertsGranted, useAlertsStatus } from './alerts-panel';
import { STATUS_TEXT } from './media-filter-panel';

type State = { kind: 'loading' } | { kind: 'ready'; status: Status } | { kind: 'error' };
type Tone = 'on' | 'off' | 'attention';

const DOT: Record<Tone, string> = {
  on: 'bg-emerald-600',
  off: 'bg-slate-400',
  attention: 'bg-amber-500',
};

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The three protections and their live state in this browser: what each is doing now, not just
 * whether the build ships it.
 */
export function FeatureStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [filter, setFilter] = useState<FilterStateMessage | 'failed' | null>(null);
  const [account, setAccount] = useState<AccountState | null>(null);
  const [granted] = useAlertsGranted();
  const alerts = useAlertsStatus(granted);

  useEffect(() => {
    send({ type: 'status/get' }).then(
      (status) => {
        setState({ kind: 'ready', status });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
    send({ type: 'filter/get' }).then(setFilter, () => {
      setFilter('failed');
    });
    send({ type: 'account/get' }).then(setAccount, () => undefined);
  }, []);

  if (state.kind === 'loading') {
    return <div aria-hidden="true" className="bg-muted h-[124px] rounded-lg" />;
  }
  if (state.kind === 'error') {
    return (
      <p role="alert" className="text-destructive text-sm">
        Could not reach the Resolve background service. Try reopening this window.
      </p>
    );
  }

  function live(id: FeatureId, available: boolean): { text: string; tone: Tone } {
    if (!available) return { text: 'Not supported in this browser', tone: 'off' };
    if (id === 'ai-filter') {
      if (!filter) return { text: 'Checking…', tone: 'off' };
      if (filter === 'failed') return { text: 'Status unavailable', tone: 'attention' };
      if (filter.status === 'needsAccess') {
        return { text: 'Needs site access: open Settings to fix', tone: 'attention' };
      }
      return { text: STATUS_TEXT[filter.status], tone: filter.status === 'on' ? 'on' : 'off' };
    }
    if (id === 'accountability') {
      if (!alerts) return { text: 'Checking…', tone: 'off' };
      if (alerts.state === 'unsupported')
        return { text: 'Not supported in this browser', tone: 'off' };
      const tone: Tone =
        alerts.state === 'on' ? 'on' : alerts.state === 'inactive' ? 'attention' : 'off';
      return { text: capitalise(describe(alerts)), tone };
    }
    if (!account) return { text: 'Checking…', tone: 'off' };
    if (account.state === 'unconfigured')
      return { text: 'Not available in this build', tone: 'off' };
    if (account.state === 'signedOut') return { text: 'Off: sign in to start', tone: 'off' };
    if (!account.activeGroupId) return { text: 'Off: choose a group', tone: 'off' };
    switch (account.protection.state) {
      case 'on':
        return { text: 'On', tone: 'on' };
      case 'idle':
        return { text: 'On, no websites listed yet', tone: 'on' };
      case 'starting':
        return { text: 'Turning on…', tone: 'attention' };
      case 'stale':
        return { text: 'On, but the list is out of date', tone: 'attention' };
      case 'error':
        return { text: 'Not working: open the popup to retry', tone: 'attention' };
      default:
        return { text: 'Off', tone: 'off' };
    }
  }

  return (
    <div>
      <ul className="divide-y rounded-lg border" aria-label="Protection features">
        {state.status.features.map((feature) => {
          const { text, tone } = live(feature.id, feature.available);
          return (
            <li
              key={feature.id}
              role={tone === 'attention' ? 'alert' : undefined}
              className="flex items-start gap-2.5 px-3 py-2.5 text-sm"
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[tone]}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{FEATURE_LABELS[feature.id]}</span>
                <span
                  className={
                    tone === 'attention'
                      ? 'block text-xs text-amber-800 dark:text-amber-300'
                      : 'text-muted-foreground block text-xs'
                  }
                >
                  {text}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground mt-2 text-xs">Version {state.status.version}</p>
      <p className="text-muted-foreground mt-1 text-xs">
        Copyright © Jervil Angelo De Leon. All rights reserved.
      </p>
    </div>
  );
}
