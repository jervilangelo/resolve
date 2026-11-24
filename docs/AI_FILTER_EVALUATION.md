<!--
Resolve — Take every thought captive.
Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# On-device media filter: evaluation

Evaluation of the Phase 6 media filter (docs/MASTER_PLAN.md §5, FR-12): the model chosen, how
it is wired into the extension, measured accuracy and speed, and known limits. Measured on
2026-11-24 with nsfwjs 4.4.0 and TensorFlow.js 4.22.0.

## Decision

**NSFWJS MobileNetV2-Mid** (MIT licence) on TensorFlow.js, WebGL backend with a CPU fallback.

| Candidate (all NSFWJS)    | Format           | Weights | Input | Published accuracy | Verdict                                                   |
| ------------------------- | ---------------- | ------- | ----- | ------------------ | --------------------------------------------------------- |
| MobileNetV2 (small)       | Layers model     | 2.6 MB  | 224   | ~90%               | Needs the extra tfjs-layers runtime; less accurate        |
| **MobileNetV2-Mid**       | **Graph model**  | 4.3 MB  | 224   | **~93%**           | **Chosen**: best accuracy per byte, graph runtime only    |
| InceptionV3               | Layers model     | ~21 MB  | 299   | ~93%               | Five times larger and slower for no published gain        |

The model ships inside the extension. `scripts/extract-nsfw-model.mjs` unpacks it at build time
from the npm package (pinned by the lockfile) into plain `model.json` + binary shards; nothing is
downloaded at runtime and no remote code is loaded. The model's MIT notice ships beside it.

## How it works

1. **Off until chosen.** The filter is off by default. Turning it on in Settings asks the
   browser for access to all sites, an optional permission that is not requested at install. The
   content script is registered only while the filter is on and access is held. If the user
   withdraws access, the extension notices and unregisters the script.
2. **Blur first.** A stylesheet injected at `document_start` blurs every `img` and `video` before
   the page paints. An element is un-blurred only when classified as likely safe.
3. **Visible first, bounded.** Images are checked once they near the viewport, at most 3 at a
   time per page. The background holds one queue for the whole browser: 2 classifications at
   once and at most 200 waiting. When the queue is full it answers "busy", and pages back off and
   retry. Concurrent requests for the same URL share one classification, and the last 1,000
   URL results are cached as scores in memory.
4. **Reading pixels.** If the page may read an image itself (same-origin, CORS, `data:` or
   `blob:`), the content script sends a 224×224 JPEG thumbnail to the extension. Otherwise the
   extension's offscreen document re-reads the image URL from the extension's own origin, without
   cookies or a referrer. The image is decoded straight to 224×224, and the full-size image is
   never kept.
5. **Inference** runs in an offscreen document. TensorFlow.js loads on first use, and the document
   closes itself after a minute idle, releasing the model's memory.
6. **Video.** Visible videos are sampled every 2 s while playing (first frame immediately).
   After a sensitive frame, two consecutive safe frames are needed before the blur lifts. Videos
   whose frames the browser withholds (cross-origin without CORS, DRM) cannot be checked.
7. **Re-checks.** A changed `src`/`srcset`, a responsive source switch or a lazy load re-blurs
   the element and checks it again.
8. **Fallback.** Media that cannot be checked (unreadable, fetch or decode failure, model error,
   queue busy after retries) follows the user's setting. The default is **keep blurred**; the
   alternative is "show". SVGs are treated as safe, since they are vector logos and icons the model
   cannot read. Images under 64 px on a side, and broken images, are also treated as safe.

**Privacy.** No pixels, thumbnails, scores or verdicts are sent to Resolve's servers, the group
or any third party. Content scripts receive only a verdict (`blur`/`show`/`unverified`/`busy`).
Nothing about media is persisted: the URL score cache lives in the worker's memory and the page's
verdicts in the page's memory. The only network traffic the filter causes is the extension
re-reading cross-origin images from the servers that already served them to the page. The
end-to-end test proves this with Chromium's whole-browser network log
(`tests/e2e/specs/media-filter.spec.ts`).

## Sensitivity

The model gives probabilities for five classes: drawing, hentai, neutral, porn and sexy. The
explicit score is porn + hentai + w × sexy, and media is blurred at or above the threshold
(`apps/extension/lib/media/policy.ts`):

| Level              | w (suggestive weight) | Threshold | Intent                                     |
| ------------------ | --------------------- | --------- | ------------------------------------------ |
| Strict             | 1                     | 0.20      | Also blurs suggestive images (e.g. swimwear) |
| Balanced (default) | 0.5                   | 0.35      | Explicit and strongly suggestive           |
| Relaxed            | 0                     | 0.60      | Clearly explicit only                      |

Stricter levels never blur less than looser ones (unit-tested).

## Accuracy

Harness: `apps/extension/scripts/evaluate-model.ts <dataset>`. It runs the same model and
preprocessing on the CPU backend, which computes the same function as WebGL, and reports blurred
shares per label folder. Datasets are never committed.

**False positives, measured.** 300 general photos (the first 300 images of the Lorem Picsum /
Unsplash catalogue: landscapes, cities, animals, objects, food and some people):

| Level    | Safe photos blurred |
| -------- | ------------------- |
| Strict   | 2.7% (8 of 300)     |
| Balanced | 1.7% (5)            |
| Relaxed  | 1.0% (3)            |

Every false positive was a close-up with skin-like tones and soft focus: a cat's nose (0.86), a
blurred cup and hand (0.80), and textured surfaces. No photo of people was blurred.

**False negatives, not yet measured.** Measuring how much explicit media gets through needs a
labelled explicit dataset. One was deliberately not downloaded or created for this repository.
The published NSFWJS figure is ~93% accuracy for this model. To measure it, the owner (or a
reviewer with an appropriate dataset) runs the harness with `explicit/` and `suggestive/` folders
alongside `safe/`. It prints the blurred share of each folder at each level: for explicit, the
share _not_ blurred is the false-negative rate. Record the results here before relying on
specific numbers in store listings or marketing.

## Performance

`tests/e2e/scripts/media-benchmark.ts`, Chromium 159 on the development PC (Windows 11):

| Measurement                                          | Headless | Headed |
| ---------------------------------------------------- | -------- | ------ |
| Cold start: load TF.js and model, first image        | 3.1 s    | 3.2 s  |
| Warm, per image (fetch, decode, inference), median   | 33 ms    | 35 ms  |
| Warm, per image, p95                                 | 39 ms    | 40 ms  |
| 24-image page fully checked, model cold              | 1.25 s   | 1.43 s |
| 24-image page fully checked, model warm              | 0.68 s   | 0.94 s |
| Main-thread blocking on that page (filter off → on)  | 0 → 0–14 ms | 0 → 2–28 ms |

Page times include scrolling through the page. Inference runs outside the page (offscreen
document, WebGL), so pages stay responsive; the main-thread cost is drawing thumbnails and
observers. Bundle cost: content script 8 KB per frame, classifier 0.8 MB loaded only in the
offscreen document, model 4.3 MB. Memory has not been profiled yet. The offscreen document is
released after a minute idle.

## Limitations (tested or by design)

- **Not covered:** CSS background images, `<canvas>` drawings, media inside shadow DOM, and
  images rendered by plugins. These are not blurred at all.
- **Cannot be checked:** cross-origin video without CORS, DRM video, and images whose server
  refuses requests without cookies. These follow the fallback setting (default blurred).
- **Video** is sampled, not checked frame by frame: a sensitive scene can show for up to ~2 s
  before it blurs.
- **Flash of blur:** media appears blurred until checked (about 40 ms per image once the model is
  warm, a few seconds for the first image after the browser starts).
- **Pages already open** when the filter is turned on or off change only after a reload.
- **Browsers:** Chromium (Chrome, Edge, Brave). Firefox has no offscreen documents; its adapter
  is pending (Firefox is on hold).
- **The model makes mistakes** both ways (see Accuracy). Resolve presents the filter as a
  supporting tool, never as complete protection.

## Reproduce

```sh
pnpm --filter @resolve/extension build
node apps/extension/scripts/evaluate-model.ts <dataset-dir>   # accuracy
node tests/e2e/scripts/media-benchmark.ts <jpeg-dir> [--headed] # speed
pnpm e2e                                                        # behaviour + zero-upload check
```
