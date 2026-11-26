/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { FaqItem } from '@/lib/faq';

/** Questions as accordions; one open at a time within the group. */
export function FaqList({ items, name }: { items: FaqItem[]; name: string }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details
          key={item.q}
          name={name}
          className="group bg-card rounded-xl border transition-colors open:shadow-sm"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-medium [&::-webkit-details-marker]:hidden">
            {item.q}
            <span aria-hidden="true" className="relative size-3.5 shrink-0">
              <span className="absolute top-1/2 left-0 h-[2px] w-3.5 -translate-y-1/2 rounded-full bg-current" />
              <span className="absolute top-1/2 left-0 h-[2px] w-3.5 -translate-y-1/2 rotate-90 rounded-full bg-current transition-transform group-open:rotate-0" />
            </span>
          </summary>
          <p className="text-muted-foreground px-5 pb-5 leading-relaxed">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
