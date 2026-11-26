/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

// Unpacks the NSFWJS MobileNetV2-Mid graph model (MIT, pinned in apps/extension/package.json)
// from the npm package's base64 JavaScript bundles into a plain TensorFlow.js model directory
// (model.json + binary weight shards) under apps/extension/public/models/nsfw/. The extension
// ships these files and loads them from its own origin: no model is ever fetched remotely.
// The output is git-ignored and regenerated on every extension build.

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extension = path.join(root, 'apps/extension');
const out = path.join(extension, 'public/models/nsfw');

// nsfwjs does not export its package.json: resolve its entry point from the extension (works with
// isolated and hoisted node_modules alike) and walk up to the package root.
const entry = createRequire(path.join(extension, 'package.json')).resolve('nsfwjs');
let pkgDir = path.dirname(realpathSync(entry));
while (!existsSync(path.join(pkgDir, 'package.json')) || path.basename(pkgDir) !== 'nsfwjs') {
  const parent = path.dirname(pkgDir);
  if (parent === pkgDir) throw new Error('nsfwjs package root not found');
  pkgDir = parent;
}
const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
const models = path.join(pkgDir, 'dist/models/mobilenet_v2_mid');
const load = createRequire(path.join(models, 'loader.cjs'));
const unwrap = (value) => value?.default ?? value;

const modelJson = unwrap(load('./model.min.js'));
if (modelJson?.format !== 'graph-model') throw new Error('Unexpected NSFWJS model format');

mkdirSync(out, { recursive: true });
const shards = [];
for (const group of modelJson.weightsManifest) {
  group.paths = group.paths.map((name) => {
    const base64 = unwrap(load(`./${name}.min.js`));
    if (typeof base64 !== 'string') throw new Error(`Weight shard ${name} is not base64 text`);
    const bytes = Buffer.from(base64, 'base64');
    const file = `${name}.bin`;
    writeFileSync(path.join(out, file), bytes);
    shards.push(bytes.length);
    return file;
  });
}
writeFileSync(path.join(out, 'model.json'), JSON.stringify(modelJson));
writeFileSync(
  path.join(out, 'NOTICE.txt'),
  `NSFWJS MobileNetV2-Mid model, from nsfwjs ${pkg.version} (https://github.com/infinitered/nsfwjs).\n\n` +
    readFileSync(path.join(pkgDir, 'LICENSE'), 'utf8'),
);
const total = shards.reduce((sum, bytes) => sum + bytes, 0);
console.log(`NSFWJS ${pkg.version} model: ${shards.length} shards, ${(total / 1e6).toFixed(2)} MB`);
