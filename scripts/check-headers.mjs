/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

// Verifies that original project source files carry the notice required by
// docs/COPYRIGHT_NOTICE.md. JSON, Markdown, assets and third-party files are exempt.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOTICE = 'Copyright © Jervil Angelo De Leon. All rights reserved.';
const SEARCH_WINDOW = 600;

const checkedExtensions = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
  '.css', // block comment
  '.tf',
  '.yml',
  '.yaml',
  '.sh', // # comment
  '.html', // <!-- --> comment
]);

// Third-party, vendored or generated sources: retain their own notices instead.
const exemptPrefixes = ['assets/', 'docs/', 'apps/web/components/ui/'];
const exemptSuffixes = ['.d.ts', 'pnpm-lock.yaml'];

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const missing = files.filter((file) => {
  if (!checkedExtensions.has(path.extname(file))) return false;
  if (exemptPrefixes.some((prefix) => file.startsWith(prefix))) return false;
  if (exemptSuffixes.some((suffix) => file.endsWith(suffix))) return false;
  try {
    return !readFileSync(path.join(root, file), 'utf8').slice(0, SEARCH_WINDOW).includes(NOTICE);
  } catch {
    return false; // deleted but still indexed
  }
});

if (missing.length > 0) {
  console.error('Missing copyright header (see docs/COPYRIGHT_NOTICE.md):');
  for (const file of missing) console.error(`  ${file}`);
  process.exit(1);
}
console.log(`Copyright headers OK (${String(files.length)} tracked files scanned).`);
