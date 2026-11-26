/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { createGroupRequestSchema, updateProfileRequestSchema } from './api';

/** Names reach alert emails, so links and addresses are refused (phishing, FR-19). */
describe('display and group names', () => {
  it('accept ordinary names', () => {
    for (const name of [
      'Bob',
      'J.R. Smith',
      "St. Mark's men",
      'Brothers in Christ',
      'Anne-Marie',
    ]) {
      expect(updateProfileRequestSchema.safeParse({ displayName: name }).success, name).toBe(true);
      expect(createGroupRequestSchema.safeParse({ name }).success, name).toBe(true);
    }
  });

  it('refuse links, web and email addresses', () => {
    for (const name of [
      'Verify at https://evil.example',
      'go to www.example',
      'evil.example',
      'Bob (bob@mail.example)',
      'see Phish.Site now',
      'verify-account。com',
      'evil．com',
    ]) {
      expect(updateProfileRequestSchema.safeParse({ displayName: name }).success, name).toBe(false);
      expect(createGroupRequestSchema.safeParse({ name }).success, name).toBe(false);
    }
  });
});
