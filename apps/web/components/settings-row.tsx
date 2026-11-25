/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A screen's title row: one noun title and an optional grey line about its data. */
export function PageTitle({
  title,
  line,
  actions,
}: {
  title: string;
  line?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {line && <p className="text-muted-foreground text-base">{line}</p>}
      </div>
      {actions}
    </header>
  );
}

/**
 * One section of a settings-style screen: its title and description in a label column beside a
 * tonal panel; stacked on narrow screens. Sections are split by a rule.
 */
export function SettingsRow({
  id,
  title,
  description,
  tone = 'default',
  panelClassName,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  tone?: 'default' | 'danger';
  panelClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid scroll-mt-20 gap-4 border-t py-8 first-of-type:border-t-0 first-of-type:pt-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-10"
    >
      <div className="space-y-1.5 lg:pt-2">
        <h2
          id={id}
          className={cn('text-base font-medium', tone === 'danger' && 'text-destructive')}
        >
          {title}
        </h2>
        {description && (
          <div className="text-muted-foreground space-y-2 text-sm">{description}</div>
        )}
      </div>
      <div className={cn('bg-muted/60 min-w-0 rounded-2xl p-4 sm:p-5', panelClassName)}>
        {children}
      </div>
    </section>
  );
}
