/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import * as tf from '@tensorflow/tfjs-core';
import { type GraphModel, loadGraphModel } from '@tensorflow/tfjs-converter';

/**
 * On-device image classifier (docs/MASTER_PLAN.md §5): the NSFWJS MobileNetV2-Mid graph model on
 * TensorFlow.js. Pixels never leave the device; this module only turns pixels into five class
 * probabilities. It has no relative imports so the Node evaluation harness can load it directly.
 */
export const CLASSES = ['drawing', 'hentai', 'neutral', 'porn', 'sexy'] as const;
export type MediaClass = (typeof CLASSES)[number];
export type Scores = Record<MediaClass, number>;

/** The model's square input size. */
export const INPUT_SIZE = 224;

export type PixelSource = Parameters<typeof tf.browser.fromPixels>[0];

export interface Classifier {
  readonly backend: string;
  classify(pixels: PixelSource): Promise<Scores>;
  dispose(): void;
}

/**
 * Loads the model from a URL (the extension's own origin) or an IO handler (tests, Node), and warms
 * it up so the first real classification does not pay for shader compilation.
 */
export async function createClassifier(source: string | tf.io.IOHandler): Promise<Classifier> {
  await tf.ready();
  const model: GraphModel = await loadGraphModel(source);
  const run = (input: tf.Tensor4D) => model.predict(input) as tf.Tensor2D;
  const warm = tf.tidy(() => run(tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 3])));
  await warm.data();
  warm.dispose();

  return {
    backend: tf.getBackend(),
    async classify(pixels) {
      const output = tf.tidy(() => {
        // Same preprocessing as NSFWJS: scale to [0, 1] and stretch to the input size.
        const image = tf.div(tf.cast(tf.browser.fromPixels(pixels), 'float32'), 255);
        const sized =
          image.shape[0] === INPUT_SIZE && image.shape[1] === INPUT_SIZE
            ? image
            : tf.image.resizeBilinear(image as tf.Tensor3D, [INPUT_SIZE, INPUT_SIZE], true);
        return run(tf.expandDims<tf.Tensor4D>(sized, 0));
      });
      const values = await output.data();
      output.dispose();
      return Object.fromEntries(CLASSES.map((name, i) => [name, values[i] ?? 0])) as Scores;
    },
    dispose() {
      model.dispose();
    },
  };
}
