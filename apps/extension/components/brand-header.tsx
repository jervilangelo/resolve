/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

/** One-colour horizontal lockup matching the monochrome interface; ≥140 px wide per guidelines. */
export function BrandHeader() {
  return (
    <header className="flex items-center border-b px-4 py-3">
      <img
        src="/brand/horizontal-black.svg"
        alt="Resolve"
        height={38}
        width={146}
        className="rs-only-light h-[38px] w-auto"
      />
      <img
        src="/brand/horizontal-white.svg"
        alt=""
        aria-hidden
        height={38}
        width={146}
        className="rs-only-dark h-[38px] w-auto"
      />
    </header>
  );
}
