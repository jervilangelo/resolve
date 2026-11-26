/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

/* eslint-disable no-console -- a command-line report */

// Accuracy harness for the on-device media classifier (docs/AI_FILTER_EVALUATION.md).
//
//   node scripts/evaluate-model.ts <dataset-dir>
//
// <dataset-dir> holds one folder per label: `safe/`, `explicit/` and optionally `suggestive/`
// (JPEG, PNG, WebP or GIF). Datasets are never committed. The model runs on the TensorFlow.js CPU
// backend, which computes the same function as the browser's WebGL backend; browser speed is
// measured separately in the end-to-end tests. Prints false-positive and false-negative rates per
// sensitivity plus the highest-scoring safe images, which are the ones worth inspecting.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import '@tensorflow/tfjs-backend-cpu';
import * as tf from '@tensorflow/tfjs-core';
import sharp from 'sharp';
import { INPUT_SIZE, type Scores, createClassifier } from '../lib/media/classifier.ts';
import { SENSITIVITIES, explicitScore, shouldBlur } from '../lib/media/policy.ts';

const LABELS = ['safe', 'suggestive', 'explicit'] as const;
type Label = (typeof LABELS)[number];
const IMAGE = /\.(jpe?g|png|webp|gif)$/i;

const dataset = process.argv[2];
if (!dataset) throw new Error('Usage: node scripts/evaluate-model.ts <dataset-dir>');

const modelDir = path.join(import.meta.dirname, '../public/models/nsfw');
const modelJson = JSON.parse(readFileSync(path.join(modelDir, 'model.json'), 'utf8')) as {
  modelTopology: object;
  weightsManifest: { paths: string[]; weights: tf.io.WeightsManifestEntry[] }[];
};
const weightData = Buffer.concat(
  modelJson.weightsManifest.flatMap((g) =>
    g.paths.map((p) => readFileSync(path.join(modelDir, p))),
  ),
);
await tf.setBackend('cpu');
const classifier = await createClassifier(
  tf.io.fromMemory({
    modelTopology: modelJson.modelTopology,
    weightSpecs: modelJson.weightsManifest.flatMap((g) => g.weights),
    weightData: new Uint8Array(weightData).buffer,
    format: 'graph-model',
  }),
);

const results: { label: Label; file: string; scores: Scores; ms: number }[] = [];
for (const label of LABELS) {
  let files: string[];
  try {
    files = readdirSync(path.join(dataset, label)).filter((f) => IMAGE.test(f));
  } catch {
    continue;
  }
  for (const file of files) {
    // Browsers stretch the image to the input size (drawImage / createImageBitmap resize).
    const { data } = await sharp(path.join(dataset, label, file), { animated: false })
      .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const start = performance.now();
    const scores = await classifier.classify({
      data: new Uint8Array(data),
      width: INPUT_SIZE,
      height: INPUT_SIZE,
    });
    results.push({ label, file, scores, ms: performance.now() - start });
  }
}

const pct = (n: number, d: number) =>
  d === 0 ? '   n/a' : `${((100 * n) / d).toFixed(1)}%`.padStart(6);
const count = (label: Label) => results.filter((r) => r.label === label).length;
console.log(`Images: ${LABELS.map((l) => `${l} ${count(l)}`).join(', ')}`);
console.log(
  'Blurred share by label (safe = false positives; explicit not blurred = false negatives)',
);
for (const level of SENSITIVITIES) {
  const rate = (label: Label) =>
    pct(
      results.filter((r) => r.label === label && shouldBlur(r.scores, level)).length,
      count(label),
    );
  console.log(
    `  ${level.padEnd(8)} safe ${rate('safe')}  suggestive ${rate('suggestive')}  explicit ${rate('explicit')}`,
  );
}
const safe = results
  .filter((r) => r.label === 'safe')
  .sort((a, b) => explicitScore(b.scores, 'strict') - explicitScore(a.scores, 'strict'));
console.log('Highest-scoring safe images (strict score; porn / hentai / sexy):');
for (const r of safe.slice(0, 10)) {
  const s = r.scores;
  console.log(
    `  ${r.file.padEnd(16)} ${explicitScore(s, 'strict').toFixed(3)}  ${s.porn.toFixed(3)} / ${s.hentai.toFixed(3)} / ${s.sexy.toFixed(3)}`,
  );
}
const times = results.map((r) => r.ms).sort((a, b) => a - b);
console.log(
  `CPU-backend inference median ${times[Math.floor(times.length / 2)]?.toFixed(0)} ms (${classifier.backend})`,
);
classifier.dispose();
