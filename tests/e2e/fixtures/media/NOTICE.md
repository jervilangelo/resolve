<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Media filter test fixtures

Harmless photos used by `specs/media-filter.spec.ts`, resized to 480×360, under the
[Unsplash License](https://unsplash.com/license) (via Lorem Picsum):

| File                                            | Photo                                                                                     | Why                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `flagged-cat-nose.jpg`, `flagged-cat-nose.webm` | Ryan Mcguire, [unsplash.com/photos/N-1XGL54pQg](https://unsplash.com/photos/N-1XGL54pQg)  | A cat's nose the model misreads as explicit (score ≈ 0.85), so tests exercise the "keep blurred" path without explicit material. |
| `safe-forest.jpg`, `safe-forest.webm`           | Paul Jarvis, [unsplash.com/photos/6J--NXulQCs](https://unsplash.com/photos/6J--NXulQCs)   | Clearly safe (score < 0.01).                                                                                                     |
| `safe-dog.jpg`                                  | Matthew Wiebe, [unsplash.com/photos/U5rMrSI7Pn4](https://unsplash.com/photos/U5rMrSI7Pn4) | Clearly safe (score < 0.01).                                                                                                     |

The `.webm` files are 8-second VP9 stills of the matching photo (`ffmpeg -loop 1 -t 8 -r 5`).
