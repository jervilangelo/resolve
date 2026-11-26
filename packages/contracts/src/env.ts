/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { z } from 'zod';

/**
 * Thrown when environment configuration is invalid. The message names the offending variables
 * and the validation problem but never the supplied values, which may be secrets.
 */
export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(scope: string, issues: readonly string[]) {
    super(`Invalid environment for ${scope}:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/** Validate `source` (usually `process.env`) against `schema`, failing fast and safely. */
export function parseEnv<T extends z.ZodType>(
  scope: string,
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  throw new EnvValidationError(
    scope,
    result.error.issues.map((issue) => {
      const name = issue.path.map(String).join('.') || '(root)';
      return `${name}: ${issue.message}`;
    }),
  );
}
