/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

// Copies the finished brand assets (assets/branding, the single source of truth) into each
// app's public directory, as described in docs/BRAND_GUIDELINES.md § Implementation.
// The copies are git-ignored; run with an app name to sync only that app.

import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = path.join(root, 'assets/branding');

/** @type {Record<string, Array<[from: string, to: string, filter?: RegExp]>>} */
const targets = {
  web: [
    ['web', 'apps/web/public'],
    ['social/og-image.png', 'apps/web/public/og-image.png'],
    ['logo', 'apps/web/public/brand', /^(horizontal|stacked|tagline|symbol)-.*\.svg$/],
  ],
  extension: [
    ['extension', 'apps/extension/public/icon', /^icon-\d+\.png$/],
    ['logo', 'apps/extension/public/brand', /^horizontal-(black|white)\.svg$/],
  ],
};

function copy(from, to, filter) {
  const source = path.join(brand, from);
  const destination = path.join(root, to);
  if (!filter && path.extname(source)) {
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    return 1;
  }
  mkdirSync(destination, { recursive: true });
  const files = readdirSync(source, { withFileTypes: true }).filter(
    (entry) => entry.isFile() && (!filter || filter.test(entry.name)),
  );
  for (const file of files)
    copyFileSync(path.join(source, file.name), path.join(destination, file.name));
  return files.length;
}

const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !(name in targets));
if (unknown.length > 0) {
  console.error(
    `Unknown target(s): ${unknown.join(', ')}. Expected: ${Object.keys(targets).join(', ')}`,
  );
  process.exit(1);
}

for (const name of requested.length > 0 ? requested : Object.keys(targets)) {
  const count = targets[name].reduce((sum, [from, to, filter]) => sum + copy(from, to, filter), 0);
  console.log(`Brand assets synced for ${name} (${String(count)} files).`);
}
