/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['**/*.test.ts'], exclude: ['node_modules/**'], testTimeout: 30_000 },
});
