/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

/** A flat grey bar standing in for a value of the same size (no shimmer). */
function Bar({ className }: { className: string }) {
  return <span aria-hidden="true" className={`bg-muted block rounded-md ${className}`} />;
}

/**
 * The dashboard while its data loads: the final layout with each value replaced by a bar at its
 * real size, and one line saying what is happening. The layout does not move when data lands.
 */
export function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-12">
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">Getting your dashboard ready…</p>
        <Bar className="h-10 w-full max-w-md sm:h-12" />
        <Bar className="h-5 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-card space-y-4 rounded-2xl border p-4">
            <Bar className="h-4 w-20" />
            <Bar className="h-7 w-12" />
            <Bar className="h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="bg-muted/50 space-y-3 rounded-2xl p-5 lg:col-span-9">
          <Bar className="h-5 w-40" />
          {[0, 1, 2].map((i) => (
            <Bar key={i} className="bg-card h-16 w-full" />
          ))}
        </div>
        <div className="bg-muted/50 space-y-3 rounded-2xl p-5 lg:col-span-3">
          <Bar className="h-5 w-28" />
          <Bar className="bg-card h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
