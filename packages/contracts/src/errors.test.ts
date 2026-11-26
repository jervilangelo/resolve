/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { ERROR_STATUS, apiErrorResponseSchema, errorCodeSchema } from './errors';
import { healthResponseSchema } from './health';

describe('error contract', () => {
  it('maps every error code to an HTTP status', () => {
    for (const code of errorCodeSchema.options) {
      expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
    }
  });

  it('rejects unknown fields in error bodies', () => {
    const valid = { error: { code: 'FORBIDDEN', message: 'Forbidden.', correlationId: 'abc' } };
    expect(apiErrorResponseSchema.safeParse(valid).success).toBe(true);
    const extra = { error: { ...valid.error, detail: 'https://example.com' } };
    expect(apiErrorResponseSchema.safeParse(extra).success).toBe(false);
  });
});

describe('health contract', () => {
  it('accepts the documented shape only', () => {
    expect(
      healthResponseSchema.safeParse({ status: 'ok', service: 'resolve-api', stage: 'dev' })
        .success,
    ).toBe(true);
    expect(healthResponseSchema.safeParse({ status: 'ok' }).success).toBe(false);
  });
});
