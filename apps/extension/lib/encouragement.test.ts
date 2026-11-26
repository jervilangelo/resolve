/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_QUOTE, QUOTATIONS, REFLECTIONS, pickIndex } from './encouragement';

describe('encouragement library', () => {
  it('attributes every quotation: Scripture to KJV, everything else to an author and work', () => {
    for (const q of QUOTATIONS) {
      expect(q.text.trim()).not.toBe('');
      if (q.source.endsWith('(KJV)')) expect(q.work).toBeUndefined();
      else expect(q.work?.trim()).toBeTruthy();
    }
    expect(QUOTATIONS[0]).toBe(DEFAULT_QUOTE);
    expect(REFLECTIONS[0]).toBe('Will this glorify God?');
    expect(new Set(QUOTATIONS.map((q) => q.text)).size).toBe(QUOTATIONS.length);
  });

  it('never repeats the previous pick and reaches every other entry', () => {
    for (const length of [2, 3, REFLECTIONS.length, QUOTATIONS.length]) {
      for (let previous = 0; previous < length; previous++) {
        const seen = new Set<number>();
        for (let i = 0; i < length * 4; i++) {
          const index = pickIndex(length, previous, () => (i % (length * 4)) / (length * 4));
          expect(index).not.toBe(previous);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(length);
          seen.add(index);
        }
        expect(seen.size).toBe(length - 1);
      }
    }
  });

  it('handles no history, bad history and tiny lists', () => {
    expect(pickIndex(5, null, () => 0.99)).toBe(4);
    expect(pickIndex(5, 42, () => 0)).toBe(0);
    expect(pickIndex(1, 0)).toBe(0);
    expect(pickIndex(0, null)).toBe(0);
    expect(pickIndex(5, 4, () => 0.999999)).toBe(3);
  });
});
