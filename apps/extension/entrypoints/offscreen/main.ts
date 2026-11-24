/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browser } from 'wxt/browser';
import type { Classifier } from '@/lib/media/classifier';
import {
  type MediaSource,
  type OffscreenResponse,
  offscreenRequestSchema,
} from '@/lib/media/protocol';

/**
 * Offscreen document hosting the on-device classifier (Chromium). The background worker creates
 * it on demand; it closes itself after a quiet minute so the model's memory is released. It only
 * answers the background worker, and it keeps no pixels after a classification completes.
 */
const IDLE_CLOSE_MS = 60_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** The model's input size (lib/media/classifier.ts), duplicated to keep TensorFlow.js lazy. */
const INPUT_SIZE = 224;

let classifier: Promise<Classifier> | null = null;
let active = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function model(): Promise<Classifier> {
  classifier ??= (async () => {
    // Loaded on first use, so the message listener below is registered as soon as the document
    // starts rather than after TensorFlow.js has been evaluated.
    const [tf, { createClassifier }] = await Promise.all([
      import('@tensorflow/tfjs-core'),
      import('@/lib/media/classifier'),
      import('@tensorflow/tfjs-backend-cpu'),
      import('@tensorflow/tfjs-backend-webgl'),
    ]);
    // WebGL keeps inference off the CPU; the CPU backend is a slower fallback.
    const webgl = await tf.setBackend('webgl').catch(() => false);
    if (!webgl) await tf.setBackend('cpu');
    return createClassifier(browser.runtime.getURL('/models/nsfw/model.json'));
  })().catch((error: unknown) => {
    classifier = null;
    throw error;
  });
  return classifier;
}

class Unreadable extends Error {
  constructor(readonly reason: 'fetch' | 'decode' | 'vector') {
    super(reason);
  }
}

/** Decodes the image straight to the model's input size; the full-size image is never kept. */
async function pixels(source: MediaSource): Promise<ImageBitmap> {
  let blob: Blob;
  try {
    const response = await fetch(source.kind === 'url' ? source.url : source.dataUrl, {
      // The page already displayed this image; re-reading it needs no cookies or referrer.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'force-cache',
    });
    const length = Number(response.headers.get('content-length') ?? 0);
    if (!response.ok || length > MAX_IMAGE_BYTES) throw new Unreadable('fetch');
    blob = await response.blob();
  } catch (error) {
    throw error instanceof Unreadable ? error : new Unreadable('fetch');
  }
  if (blob.size > MAX_IMAGE_BYTES) throw new Unreadable('fetch');
  if (blob.type.includes('svg')) throw new Unreadable('vector');
  try {
    return await createImageBitmap(blob, {
      resizeWidth: INPUT_SIZE,
      resizeHeight: INPUT_SIZE,
      resizeQuality: 'medium',
    });
  } catch {
    throw new Unreadable('decode');
  }
}

async function classify(source: MediaSource): Promise<OffscreenResponse> {
  let image: ImageBitmap;
  try {
    image = await pixels(source);
  } catch (error) {
    return { ok: false, reason: error instanceof Unreadable ? error.reason : 'fetch' };
  }
  try {
    return { ok: true, scores: await (await model()).classify(image) };
  } catch {
    return { ok: false, reason: 'model' };
  } finally {
    image.close();
  }
}

function scheduleIdleClose(): void {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (active === 0) window.close();
  }, IDLE_CLOSE_MS);
}

browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  // Every extension context receives runtime messages; answer only the background worker.
  if (sender.id !== browser.runtime.id || sender.tab) return;
  if (sender.url !== browser.runtime.getURL('/background.js')) return;
  const request = offscreenRequestSchema.safeParse(message);
  if (!request.success) return;
  active += 1;
  clearTimeout(idleTimer);
  void classify(request.data.source)
    .then(sendResponse)
    .finally(() => {
      active -= 1;
      scheduleIdleClose();
    });
  return true;
});
scheduleIdleClose();
