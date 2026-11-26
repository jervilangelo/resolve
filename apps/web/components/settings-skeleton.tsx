/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

function Bar({ className }: { className: string }) {
  return <span aria-hidden="true" className={`bg-muted block rounded-md ${className}`} />;
}

/** Skeleton of a settings-style screen: title, optional tabs, and label/panel rows. */
export function SettingsSkeleton({ tabs = false, rows = 2 }: { tabs?: boolean; rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-8 space-y-3">
        <Bar className="h-7 w-48" />
        <Bar className="h-5 w-72 max-w-full" />
      </div>
      {tabs && (
        <div className="mb-8 flex gap-6 border-b pb-3">
          {[0, 1, 2, 3].map((i) => (
            <Bar key={i} className="h-4 w-20" />
          ))}
        </div>
      )}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="grid gap-4 border-t py-8 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-10"
        >
          <div className="space-y-2 lg:pt-2">
            <Bar className="h-5 w-36" />
            <Bar className="h-4 w-full max-w-xs" />
            <Bar className="h-4 w-2/3 max-w-xs" />
          </div>
          <div className="bg-muted/60 space-y-2 rounded-2xl p-4 sm:p-5">
            <Bar className="bg-card h-[63px] w-full" />
            <Bar className="bg-card h-[63px] w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
