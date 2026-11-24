/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import type { Scores } from './classifier';
import { createMediaEngine } from './engine';
import { LEVELS, type Sensitivity, explicitScore, shouldBlur } from './policy';
import type { MediaSource, OffscreenResponse } from './protocol';

const scores = (porn: number, sexy = 0, hentai = 0): Scores => ({
  drawing: 0,
  hentai,
  neutral: 1 - porn - sexy - hentai,
  porn,
  sexy,
});
const url = (path: string): MediaSource => ({ kind: 'url', url: `https://img.example/${path}` });
const pixels: MediaSource = { kind: 'pixels', dataUrl: 'data:image/jpeg;base64,AAAA' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(
  respond: (source: MediaSource) => Promise<OffscreenResponse>,
  limits = { concurrency: 2, maxPending: 3, cacheSize: 2 },
) {
  const calls: MediaSource[] = [];
  let sensitivity: Sensitivity = 'balanced';
  const engine = createMediaEngine(
    {
      classify: (source) => {
        calls.push(source);
        return respond(source);
      },
      sensitivity: () => Promise.resolve(sensitivity),
    },
    limits,
  );
  return {
    engine,
    calls,
    setSensitivity: (value: Sensitivity) => (sensitivity = value),
  };
}

describe('policy', () => {
  it('counts suggestive content only as far as the sensitivity asks', () => {
    const swimwear = scores(0.05, 0.6);
    expect(shouldBlur(swimwear, 'strict')).toBe(true);
    expect(shouldBlur(swimwear, 'balanced')).toBe(true);
    expect(shouldBlur(swimwear, 'relaxed')).toBe(false);
    expect(shouldBlur(scores(0.9), 'relaxed')).toBe(true);
    expect(shouldBlur(scores(0.01, 0.02), 'strict')).toBe(false);
    expect(explicitScore(scores(0.2, 0.2, 0.1), 'relaxed')).toBeCloseTo(0.3);
  });

  it('is monotonic: a stricter level never blurs less', () => {
    for (let porn = 0; porn <= 1; porn += 0.05) {
      for (let sexy = 0; sexy <= 1 - porn; sexy += 0.05) {
        const s = scores(porn, sexy);
        if (shouldBlur(s, 'relaxed')) expect(shouldBlur(s, 'balanced')).toBe(true);
        if (shouldBlur(s, 'balanced')) expect(shouldBlur(s, 'strict')).toBe(true);
      }
    }
    expect(LEVELS.strict.threshold).toBeLessThanOrEqual(LEVELS.relaxed.threshold);
  });
});

describe('media engine', () => {
  it('turns scores into verdicts with the current sensitivity', async () => {
    const t = setup(() => Promise.resolve({ ok: true, scores: scores(0.05, 0.6) }));
    expect(await t.engine.verdict(pixels)).toBe('blur');
    t.setSensitivity('relaxed');
    expect(await t.engine.verdict(pixels)).toBe('show');
  });

  it('shows vectors, and reports failures as unverified rather than safe', async () => {
    const t = setup((source) =>
      Promise.resolve(
        source.kind === 'url' && source.url.endsWith('logo')
          ? { ok: false, reason: 'vector' }
          : { ok: false, reason: 'fetch' },
      ),
    );
    expect(await t.engine.verdict(url('logo'))).toBe('show');
    expect(await t.engine.verdict(url('photo'))).toBe('unverified');
    const thrown = setup(() => Promise.reject(new Error('offscreen gone')));
    expect(await thrown.engine.verdict(pixels)).toBe('unverified');
  });

  it('classifies each URL once: concurrent requests share, later ones hit the cache', async () => {
    const gate = deferred<OffscreenResponse>();
    const t = setup(() => gate.promise);
    const first = t.engine.verdict(url('a'));
    const second = t.engine.verdict(url('a'));
    gate.resolve({ ok: true, scores: scores(0.9) });
    expect(await Promise.all([first, second])).toEqual(['blur', 'blur']);
    expect(await t.engine.verdict(url('a'))).toBe('blur');
    expect(t.calls).toHaveLength(1);
  });

  it('does not cache failures, and evicts the least recently used URL', async () => {
    let fail = true;
    const t = setup(() =>
      Promise.resolve(fail ? { ok: false, reason: 'fetch' } : { ok: true, scores: scores(0) }),
    );
    expect(await t.engine.verdict(url('a'))).toBe('unverified');
    fail = false;
    expect(await t.engine.verdict(url('a'))).toBe('show');
    await t.engine.verdict(url('b'));
    await t.engine.verdict(url('a')); // touch a, so b is now the oldest
    await t.engine.verdict(url('c')); // evicts b
    const before = t.calls.length;
    await t.engine.verdict(url('a'));
    expect(t.calls.length).toBe(before);
    await t.engine.verdict(url('b'));
    expect(t.calls.length).toBe(before + 1);
  });

  it('bounds concurrency and answers busy when the queue is full', async () => {
    const gates: ReturnType<typeof deferred<OffscreenResponse>>[] = [];
    let running = 0;
    let peak = 0;
    const t = setup(() => {
      running += 1;
      peak = Math.max(peak, running);
      const gate = deferred<OffscreenResponse>();
      gates.push(gate);
      return gate.promise.finally(() => (running -= 1));
    });
    const queued = [
      t.engine.verdict(url('1')),
      t.engine.verdict(url('2')),
      t.engine.verdict(pixels),
    ];
    expect(await t.engine.verdict(url('4'))).toBe('busy');
    expect(await t.engine.verdict(pixels)).toBe('busy');
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    await tick();
    expect(gates).toHaveLength(2); // two run at once
    gates[0]?.resolve({ ok: true, scores: scores(0) });
    await tick();
    expect(gates).toHaveLength(3); // the third starts when one finishes
    for (const gate of gates) gate.resolve({ ok: true, scores: scores(0) });
    expect(await Promise.all(queued)).toEqual(['show', 'show', 'show']);
    expect(peak).toBe(2);
    // Capacity is back once the queue drains.
    const later = t.engine.verdict(url('4'));
    await tick();
    gates[3]?.resolve({ ok: true, scores: scores(0) });
    expect(await later).toBe('show');
  });
});
