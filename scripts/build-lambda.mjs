/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

// Bundles every src/handlers/*.ts of the current service into dist/<name>/index.mjs, one
// self-contained directory per Lambda (Terraform zips each). The AWS SDK is bundled so the
// deployed version matches the lockfile rather than whatever the runtime ships.

import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const cwd = process.cwd();
const handlersDir = path.join(cwd, 'src/handlers');
const handlers = readdirSync(handlersDir).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
);

rmSync(path.join(cwd, 'dist'), { recursive: true, force: true });
await Promise.all(
  handlers.map((file) =>
    build({
      entryPoints: [path.join(handlersDir, file)],
      outfile: path.join(cwd, 'dist', path.basename(file, '.ts'), 'index.mjs'),
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'esm',
      minify: true,
      sourcemap: true,
      legalComments: 'linked',
      // Some bundled CommonJS dependencies call require(); provide it in the ESM output.
      banner: {
        js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
      logLevel: 'warning',
    }),
  ),
);
console.log(
  `Built ${String(handlers.length)} Lambda handler(s) in ${path.relative(process.cwd(), cwd) || '.'}`,
);
