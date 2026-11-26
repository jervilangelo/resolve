/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Scores } from './classifier';
import { type Sensitivity, shouldBlur } from './policy';
import type { MediaSource, OffscreenResponse, Verdict } from './protocol';

/**
 * Background side of the media filter: one bounded queue for the whole browser in front of the
 * offscreen classifier, with in-flight de-duplication and a small in-memory cache of results for
 * image URLs (scores only; no pixels are kept anywhere).
 */
export interface EngineLimits {
  /** Classifications running at once (fetch of one overlaps inference of another). */
  concurrency: number;
  /** Requests running or waiting; beyond this the engine answers `busy`. */
  maxPending: number;
  /** Image URLs whose scores are remembered (least recently used are evicted). */
  cacheSize: number;
}

export const DEFAULT_LIMITS: EngineLimits = { concurrency: 2, maxPending: 200, cacheSize: 1000 };

type Outcome = Scores | 'vector' | 'unverified';

export function createMediaEngine(
  deps: {
    classify(source: MediaSource): Promise<OffscreenResponse>;
    sensitivity(): Promise<Sensitivity>;
  },
  limits: EngineLimits = DEFAULT_LIMITS,
) {
  const cache = new Map<string, Scores | 'vector'>();
  const inFlight = new Map<string, Promise<Outcome>>();
  const waiting: (() => void)[] = [];
  let running = 0;
  let pending = 0;

  async function acquire(): Promise<void> {
    if (running < limits.concurrency) {
      running += 1;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  }

  function release(): void {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  }

  function remember(url: string, outcome: Scores | 'vector'): void {
    cache.delete(url);
    cache.set(url, outcome);
    const oldest = cache.keys().next();
    if (cache.size > limits.cacheSize && !oldest.done) cache.delete(oldest.value);
  }

  async function run(source: MediaSource): Promise<Outcome> {
    pending += 1;
    await acquire();
    try {
      const result = await deps.classify(source);
      if (result.ok) return result.scores;
      return result.reason === 'vector' ? 'vector' : 'unverified';
    } catch {
      return 'unverified';
    } finally {
      release();
      pending -= 1;
    }
  }

  async function outcome(source: MediaSource): Promise<Outcome | 'busy'> {
    if (source.kind === 'pixels') return pending >= limits.maxPending ? 'busy' : run(source);
    const cached = cache.get(source.url);
    if (cached) {
      remember(source.url, cached);
      return cached;
    }
    const shared = inFlight.get(source.url);
    if (shared) return shared;
    if (pending >= limits.maxPending) return 'busy';
    const job = run(source).then((result) => {
      if (result !== 'unverified') remember(source.url, result);
      return result;
    });
    inFlight.set(source.url, job);
    try {
      return await job;
    } finally {
      inFlight.delete(source.url);
    }
  }

  return {
    async verdict(source: MediaSource): Promise<Verdict> {
      const result = await outcome(source);
      if (result === 'busy' || result === 'unverified') return result;
      if (result === 'vector') return 'show';
      return shouldBlur(result, await deps.sensitivity()) ? 'blur' : 'show';
    },
  };
}

export type MediaEngine = ReturnType<typeof createMediaEngine>;
