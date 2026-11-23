/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import Image from 'next/image';
import { cn } from '@/lib/utils';

const lockups = {
  horizontal: { width: 741, height: 193 },
  'horizontal-compact': { width: 866, height: 208 },
  stacked: { width: 324, height: 266 },
  tagline: { width: 741, height: 193 },
} as const;

interface LogoProps {
  variant?: keyof typeof lockups;
  /** Rendered height in pixels; width follows the lockup's aspect ratio. */
  height: number;
  className?: string;
  priority?: boolean;
}

/** Brand lockup that swaps between the light and dark artwork with the active theme. */
export function Logo({ variant = 'horizontal', height, className, priority }: LogoProps) {
  const ratio = lockups[variant].width / lockups[variant].height;
  const width = Math.round(ratio * height);
  return (
    <span className={cn('inline-flex', className)}>
      {(['light', 'dark'] as const).map((theme) => (
        <Image
          key={theme}
          src={`/brand/${variant}-${theme}.svg`}
          alt={theme === 'light' ? 'Resolve' : ''}
          aria-hidden={theme === 'dark' ? true : undefined}
          width={width}
          height={height}
          priority={priority}
          className={theme === 'light' ? 'rs-only-light' : 'rs-only-dark'}
        />
      ))}
    </span>
  );
}
