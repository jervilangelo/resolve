/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { ContentConfig, MediaSource, Verdict } from './protocol';

/**
 * Page side of the media filter (docs/MASTER_PLAN.md §5.2). Every image and video starts blurred
 * by a stylesheet injected before the page paints; an element is released only once it has been
 * classified as likely safe. Visible elements are classified first, a few at a time. Pixels go
 * only to this extension's own classifier and verdicts stay in this page's memory.
 *
 * Not covered (documented limitations): CSS background images, <canvas>, closed and open shadow
 * DOM, frames of animated images after the first checked one, and media whose pixels the browser
 * withholds (cross-origin or DRM video); the latter follow the user's "media that can't be
 * checked" setting.
 */
export const MEDIA_ATTR = 'data-resolve-media';
const BLUR_CSS = `
img:not([${MEDIA_ATTR}="safe"]), video:not([${MEDIA_ATTR}="safe"]) {
  filter: blur(32px) !important;
}
img[${MEDIA_ATTR}="safe"], video[${MEDIA_ATTR}="safe"] { transition: filter 120ms ease-out; }
`;

/** Side of the square the page downscales readable pixels to (the model's input size). */
const INPUT_SIZE = 224;
/** Images smaller than this on either side (icons, spacers) are not classified. */
const MIN_SIDE = 64;
const PAGE_CONCURRENCY = 3;
const BUSY_RETRIES = 5;
const VIDEO_TICK_MS = 1000;
const VIDEO_SAMPLE_MS = 2000;
const VIDEOS_PER_TICK = 2;
/** Consecutive safe frames needed to unblur a video after a sensitive frame. */
const VIDEO_SAFE_STREAK = 2;

export interface FilterDeps {
  config(): Promise<ContentConfig>;
  classify(source: MediaSource): Promise<Verdict>;
}

type ElementState = 'safe' | 'blur' | 'unverified';

interface VideoState {
  visible: boolean;
  sampledAt: number;
  sampling: boolean;
  /** The browser withholds this video's pixels; it is never sampled again. */
  unreadable: boolean;
  blurredByModel: boolean;
  safeStreak: number;
  /** Bumped whenever the content changes (new source, seek), so late verdicts are dropped. */
  generation: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function startMediaFilter(doc: Document, deps: FilterDeps): { stop(): void } {
  const style = doc.createElement('style');
  style.textContent = BLUR_CSS;
  const attachStyle = () => {
    // At document_start the page may not have a <head> yet.
    if (!style.isConnected) (doc.querySelector('head') ?? doc.documentElement).append(style);
  };
  attachStyle();

  let config: ContentConfig = { enabled: true, unverifiable: 'blur' };
  let stopped = false;
  const configured = deps.config().then(
    (value) => {
      config = value;
      if (!value.enabled) stop();
    },
    // The extension is unreachable (e.g. updated while this page was open): nothing can be
    // checked, so everything follows the conservative default and stays blurred.
    () => undefined,
  );

  /**
   * Reads pixels the page may read itself; the browser throws for cross-origin media. A fresh
   * canvas each time: drawing a cross-origin image taints a canvas for good, which would make
   * every later read fail.
   */
  function readPixels(element: CanvasImageSource): MediaSource | null {
    const canvas = doc.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return null;
    try {
      context.drawImage(element, 0, 0, INPUT_SIZE, INPUT_SIZE);
      return { kind: 'pixels', dataUrl: canvas.toDataURL('image/jpeg', 0.92) };
    } catch {
      return null;
    }
  }

  async function verdictFor(source: MediaSource): Promise<Exclude<Verdict, 'busy'>> {
    for (let attempt = 0; attempt < BUSY_RETRIES; attempt += 1) {
      const verdict = await deps.classify(source).catch((): Verdict => 'unverified');
      if (verdict === 'busy') {
        await sleep(500 * (attempt + 1));
        continue;
      }
      return verdict;
    }
    return 'unverified';
  }

  /** `current` is re-checked after any wait, so a verdict never lands on newer content. */
  async function mark(
    element: HTMLElement,
    verdict: Exclude<Verdict, 'busy'>,
    current: () => boolean = () => true,
  ): Promise<void> {
    let state: ElementState = verdict === 'show' ? 'safe' : verdict;
    if (state === 'unverified') {
      await configured;
      if (config.unverifiable === 'show') state = 'safe';
    }
    if (!stopped && current()) element.setAttribute(MEDIA_ATTR, state);
  }

  // ---- Images -------------------------------------------------------------------------------

  /** The source each image was last checked for; a different source means a re-check. */
  const checkedSource = new WeakMap<HTMLImageElement, string>();
  /** Verdicts for image URLs already classified on this page. */
  const urlVerdicts = new Map<string, Exclude<Verdict, 'busy' | 'unverified'>>();
  const queue: HTMLImageElement[] = [];
  let running = 0;

  const imageVisibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        imageVisibility.unobserve(entry.target);
        queue.push(entry.target as HTMLImageElement);
      }
      pump();
    },
    { rootMargin: '50% 0px' },
  );

  function pump(): void {
    while (!stopped && running < PAGE_CONCURRENCY) {
      const image = queue.shift();
      if (!image) return;
      const source = checkedSource.get(image);
      if (source === undefined) continue;
      running += 1;
      void checkImage(image, source).finally(() => {
        running -= 1;
        pump();
      });
    }
  }

  async function checkImage(image: HTMLImageElement, src: string): Promise<void> {
    const source =
      readPixels(image) ?? (/^https?:/i.test(src) ? { kind: 'url' as const, url: src } : null);
    const verdict = source ? await verdictFor(source) : 'unverified';
    const current = () => checkedSource.get(image) === src;
    if (!current()) return; // the element shows something else now
    if (source?.kind === 'url' && (verdict === 'blur' || verdict === 'show')) {
      urlVerdicts.set(src, verdict);
    }
    await mark(image, verdict, current);
  }

  function considerImage(image: HTMLImageElement): void {
    if (stopped) return;
    const src = image.currentSrc || image.src;
    if (checkedSource.get(image) === src) return;
    // Never trust a state this filter did not set for this source (a cloned node, or markup that
    // arrives with the attribute): blur at once, even while the image is still loading.
    image.removeAttribute(MEDIA_ATTR);
    if (!image.complete) {
      checkedSource.delete(image);
      return; // the load or error event brings it back
    }
    checkedSource.set(image, src);
    imageVisibility.unobserve(image);
    // Broken, tiny or vector images carry nothing the model can judge.
    const vector = /^data:image\/svg|\.svg(?:[?#]|$)/i.test(src);
    if (!src || image.naturalWidth === 0 || vector) {
      void mark(image, 'show');
      return;
    }
    if (image.naturalWidth < MIN_SIDE || image.naturalHeight < MIN_SIDE) {
      void mark(image, 'show');
      return;
    }
    const known = urlVerdicts.get(src);
    if (known) {
      void mark(image, known);
      return;
    }
    imageVisibility.observe(image);
  }

  // ---- Videos -------------------------------------------------------------------------------

  const videos = new Map<HTMLVideoElement, VideoState>();
  let videoTimer: ReturnType<typeof setInterval> | undefined;

  const videoVisibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const state = videos.get(entry.target as HTMLVideoElement);
      if (state) state.visible = entry.isIntersecting;
    }
  });

  function trackVideo(video: HTMLVideoElement): void {
    if (stopped || videos.has(video)) return;
    videos.set(video, {
      visible: false,
      sampledAt: 0,
      sampling: false,
      unreadable: false,
      blurredByModel: false,
      safeStreak: 0,
      generation: 0,
    });
    videoVisibility.observe(video);
    videoTimer ??= setInterval(sampleVideos, VIDEO_TICK_MS);
  }

  async function sampleVideo(video: HTMLVideoElement, state: VideoState): Promise<void> {
    state.sampling = true;
    state.sampledAt = Date.now();
    const generation = state.generation;
    const current = () => state.generation === generation;
    try {
      const source = readPixels(video);
      if (!source) {
        state.unreadable = true;
        await mark(video, 'unverified', current);
        return;
      }
      const verdict = await verdictFor(source);
      if (!current()) return; // the video shows something else now
      if (verdict === 'blur') {
        state.blurredByModel = true;
        state.safeStreak = 0;
        await mark(video, 'blur', current);
      } else if (verdict === 'show') {
        state.safeStreak += 1;
        if (!state.blurredByModel || state.safeStreak >= VIDEO_SAFE_STREAK) {
          state.blurredByModel = false;
          await mark(video, 'show', current);
        }
      } else if (video.getAttribute(MEDIA_ATTR) === null) {
        await mark(video, 'unverified', current);
      }
    } finally {
      state.sampling = false;
    }
  }

  function sampleVideos(): void {
    const now = Date.now();
    const due: [HTMLVideoElement, VideoState][] = [];
    for (const [video, state] of videos) {
      if (!video.isConnected) {
        videos.delete(video);
        videoVisibility.unobserve(video);
        continue;
      }
      if (state.sampling || state.unreadable || !state.visible) continue;
      // HAVE_CURRENT_DATA: a frame is available to read.
      if (video.readyState < 2) continue;
      if (state.sampledAt === 0 || (!video.paused && now - state.sampledAt >= VIDEO_SAMPLE_MS)) {
        due.push([video, state]);
      }
    }
    // Least recently checked first, so with many playing videos none is starved of checks.
    due.sort((a, b) => a[1].sampledAt - b[1].sampledAt);
    for (const [video, state] of due.slice(0, VIDEOS_PER_TICK)) void sampleVideo(video, state);
    if (videos.size === 0) {
      clearInterval(videoTimer);
      videoTimer = undefined;
    }
  }

  // ---- Discovery ----------------------------------------------------------------------------

  function discover(node: Node): void {
    if (!(node instanceof Element)) return;
    if (node instanceof HTMLImageElement) considerImage(node);
    else if (node instanceof HTMLVideoElement) trackVideo(node);
    for (const image of node.querySelectorAll('img')) considerImage(image);
    for (const video of node.querySelectorAll('video')) trackVideo(video);
  }

  const mutations = new MutationObserver((records) => {
    attachStyle();
    for (const record of records) {
      if (record.type === 'attributes') {
        const target = record.target;
        // A new source must not inherit the previous verdict: blur until it is checked again.
        if (target instanceof HTMLImageElement) {
          checkedSource.delete(target);
          target.removeAttribute(MEDIA_ATTR);
          considerImage(target);
        } else if (target instanceof HTMLVideoElement) {
          const state = videos.get(target);
          if (state) {
            Object.assign(state, { sampledAt: 0, unreadable: false, blurredByModel: false });
            state.generation += 1;
          }
          target.removeAttribute(MEDIA_ATTR);
        }
        continue;
      }
      for (const node of record.addedNodes) discover(node);
    }
  });
  mutations.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset'],
  });

  // Capture-phase listeners see every image load or failure (including lazy and responsive source
  // changes) and video readiness changes, none of which bubble.
  const onLoad = (event: Event) => {
    if (event.target instanceof HTMLImageElement) considerImage(event.target);
  };
  const onVideoData = (event: Event) => {
    if (!(event.target instanceof HTMLVideoElement)) return;
    const video = event.target;
    trackVideo(video);
    const state = videos.get(video);
    if (!state) return;
    if (event.type === 'seeked') {
      state.sampledAt = 0;
      state.generation += 1;
    }
    // A new source (src, <source> children or srcObject) starts loading: forget the old verdict.
    if (event.type === 'loadstart') {
      Object.assign(state, {
        sampledAt: 0,
        unreadable: false,
        blurredByModel: false,
        safeStreak: 0,
      });
      state.generation += 1;
      video.removeAttribute(MEDIA_ATTR);
    }
  };
  doc.addEventListener('load', onLoad, true);
  doc.addEventListener('error', onLoad, true);
  for (const type of ['loadstart', 'loadeddata', 'play', 'seeked'])
    doc.addEventListener(type, onVideoData, true);
  discover(doc.documentElement);

  function stop(): void {
    if (stopped) return;
    stopped = true;
    mutations.disconnect();
    imageVisibility.disconnect();
    videoVisibility.disconnect();
    clearInterval(videoTimer);
    doc.removeEventListener('load', onLoad, true);
    doc.removeEventListener('error', onLoad, true);
    for (const type of ['loadstart', 'loadeddata', 'play', 'seeked'])
      doc.removeEventListener(type, onVideoData, true);
    style.remove();
  }

  return { stop };
}
