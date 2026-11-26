/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

// Kept separate from index.mjs: eslint-config-next requires `next` to be installed.
import { defineConfig } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import { base } from './index.mjs';

/** Next.js App Router workspace; layers eslint-config-next (React, hooks, a11y, Next rules). */
export function next(options) {
  return defineConfig(base(options), nextCoreWebVitals, {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  });
}
