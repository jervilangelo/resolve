/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { EMERGENCY_PHRASE, formatRemaining } from './focus-ui';

describe('Focus countdown and emergency phrase', () => {
  it('formats the remaining time as MM:SS, rounding up and never below zero', () => {
    expect(formatRemaining(25 * 60_000)).toBe('25:00');
    expect(formatRemaining(61_001)).toBe('01:02');
    expect(formatRemaining(999)).toBe('00:01');
    expect(formatRemaining(-5000)).toBe('00:00');
    expect(formatRemaining(125 * 60_000)).toBe('125:00');
  });

  it('uses the exact emergency phrase', () => {
    expect(EMERGENCY_PHRASE).toBe('Yes, this is an emergency.');
  });
});
