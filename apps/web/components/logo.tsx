/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import Image from 'next/image';
import { cn } from '@/lib/utils';

/** One-colour lockups that match the monochrome interface (docs/BRAND_GUIDELINES.md). */
const lockups = {
  horizontal: { width: 741, height: 193 },
  symbol: { width: 256, height: 256 },
} as const;

interface LogoProps {
  variant?: keyof typeof lockups;
  /** Rendered height in pixels; width follows the lockup's aspect ratio. */
  height: number;
  className?: string;
  priority?: boolean;
}

/** Black artwork in light mode, white artwork in dark mode. */
export function Logo({ variant = 'horizontal', height, className, priority }: LogoProps) {
  const ratio = lockups[variant].width / lockups[variant].height;
  const width = Math.round(ratio * height);
  return (
    <span className={cn('inline-flex', className)}>
      {(['black', 'white'] as const).map((tone) => (
        <Image
          key={tone}
          src={`/brand/${variant}-${tone}.svg`}
          alt={tone === 'black' ? 'Resolve' : ''}
          aria-hidden={tone === 'white' ? true : undefined}
          width={width}
          height={height}
          priority={priority}
          className={tone === 'black' ? 'rs-only-light' : 'rs-only-dark'}
        />
      ))}
    </span>
  );
}
