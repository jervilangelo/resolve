/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { type HomeGroup, checklistItems } from './home';

const group = (sharing: HomeGroup['sharing']): HomeGroup => ({
  groupId: 'grp_aaaaaaaaaaaaaaaaaaaaaaaaaa',
  name: 'Grace Fellowship',
  role: 'ADMIN',
  sharing,
});
const score = (items: ReturnType<typeof checklistItems>) =>
  items.filter((i) => i.state === 'done').length;

describe('Resolve checklist', () => {
  it('is 3 of 3 with blurring on, a group, and sharing set up', () => {
    const items = checklistItems([group({ mode: 'EVERYONE', receiving: 2 })], {
      state: 'present',
      signedIn: true,
      mediaBlur: true,
    });
    expect(items.map((i) => i.title)).toEqual([
      'Media blurring',
      'Joining a group',
      'Accountability sharing',
    ]);
    expect(score(items)).toBe(3);
  });

  it('counts private sharing and a missing extension as to do, with a next step', () => {
    const items = checklistItems([group({ mode: 'PRIVATE', receiving: 0 })], { state: 'absent' });
    expect(score(items)).toBe(1);
    expect(items[0]?.action?.href).toBe('/getting-started');
    expect(items[2]?.action?.href).toContain('?tab=accountability');
  });

  it('does not score media blurring while the browser is being checked', () => {
    const items = checklistItems([], { state: 'checking' });
    expect(items[0]?.state).toBe('checking');
    expect(score(items)).toBe(0);
    expect(items[1]?.action?.href).toBe('/dashboard/groups');
    expect(items[2]?.action).toBeUndefined();
  });

  it('counts the extension with blurring off as to do, and unknown sharing as not set up', () => {
    const items = checklistItems([group(null)], {
      state: 'present',
      signedIn: true,
      mediaBlur: false,
    });
    expect(items[0]?.state).toBe('todo');
    expect(items[2]?.state).toBe('todo');
  });
});
