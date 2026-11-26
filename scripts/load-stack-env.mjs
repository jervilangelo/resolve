/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

// Runs a command with a deployed environment's Terraform outputs exported as RESOLVE_* variables,
// e.g. `node scripts/load-stack-env.mjs dev vitest run`. Requires an initialised Terraform root.

import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [stage, command, ...args] = process.argv.slice(2);
if (!stage || !command) {
  console.error('Usage: load-stack-env.mjs <stage> <command> [...args]');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tfDir = path.join(root, 'infrastructure/terraform/environments', stage);
const outputs = JSON.parse(
  execFileSync('terraform', ['output', '-json'], { cwd: tfDir, encoding: 'utf8' }),
);

const env = { ...process.env, RESOLVE_STAGE: stage };
for (const [name, { value }] of Object.entries(outputs)) {
  if (typeof value === 'string') env[`RESOLVE_${name.toUpperCase()}`] = value;
}

const result = spawnSync(command, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
