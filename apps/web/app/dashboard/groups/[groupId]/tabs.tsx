/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import Link, { useLinkStatus } from 'next/link';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { GROUP_TABS, type GroupTab } from './tab-list';

const LABELS: Record<GroupTab, string> = {
  websites: 'Websites',
  accountability: 'Accountability',
  members: 'Members',
  settings: 'Settings',
};

function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="size-3.5" /> : null;
}

/** The group's areas as underline tabs; each is its own URL, so it can be linked and reloaded. */
export function GroupTabs({ groupId, current }: { groupId: string; current: GroupTab }) {
  return (
    <nav aria-label="Group" className="mb-8 border-b">
      <ul className="-mb-px flex gap-5 overflow-x-auto sm:gap-6">
        {GROUP_TABS.map((tab) => (
          <li key={tab} className="shrink-0">
            <Link
              href={
                tab === 'websites'
                  ? `/dashboard/groups/${groupId}`
                  : `/dashboard/groups/${groupId}?tab=${tab}`
              }
              scroll={false}
              aria-current={current === tab ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-2 border-b-2 text-sm transition-colors',
                current === tab
                  ? 'border-foreground text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {LABELS[tab]}
              <Pending />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
