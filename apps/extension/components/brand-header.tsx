/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

/** Compact lockup (docs/BRAND_GUIDELINES.md: popup header) in the active theme's colours. */
export function BrandHeader() {
  return (
    <header className="flex items-center border-b px-4 py-3">
      <img
        src="/brand/horizontal-compact-light.svg"
        alt="Resolve"
        height={24}
        width={100}
        className="rs-only-light h-6 w-auto"
      />
      <img
        src="/brand/horizontal-compact-dark.svg"
        alt=""
        aria-hidden
        height={24}
        width={100}
        className="rs-only-dark h-6 w-auto"
      />
    </header>
  );
}
