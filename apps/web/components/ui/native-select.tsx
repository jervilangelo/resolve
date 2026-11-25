/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** The browser's own select (best on phones and with assistive tech), styled like Input. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'border-input bg-card h-10 rounded-[10px] border px-3 text-sm transition-[border-color,box-shadow] outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
