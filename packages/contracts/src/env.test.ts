/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EnvValidationError, parseEnv } from './env';

const schema = z.object({
  STAGE: z.enum(['dev', 'prod']),
  TOKEN_SECRET: z.string().min(32),
});

describe('parseEnv', () => {
  it('returns parsed values', () => {
    const env = parseEnv('test', schema, { STAGE: 'dev', TOKEN_SECRET: 'x'.repeat(32) });
    expect(env.STAGE).toBe('dev');
  });

  it('reports variable names but never their values', () => {
    const secret = 'short-secret-value';
    let error: unknown;
    try {
      parseEnv('test', schema, { STAGE: 'staging', TOKEN_SECRET: secret });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(EnvValidationError);
    const message = (error as EnvValidationError).message;
    expect(message).toContain('STAGE');
    expect(message).toContain('TOKEN_SECRET');
    expect(message).not.toContain(secret);
    expect(message).not.toContain('staging');
  });
});
