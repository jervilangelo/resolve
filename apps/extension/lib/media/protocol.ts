/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';
import { SENSITIVITIES } from './policy';

/**
 * Messages of the media filter. Content scripts run inside untrusted pages, so they get their own
 * narrow vocabulary: they can ask for the filter configuration and for a blur decision, and they
 * only ever receive a verdict, never scores, tokens or account data.
 */

/** Pixels the content script could read itself, downscaled to the model input as a JPEG. */
const MAX_PIXELS_DATA_URL = 400_000;

export const mediaSourceSchema = z.discriminatedUnion('kind', [
  // A web image the page displays but whose pixels the page's security rules hide from the
  // content script; the extension re-reads it from its own origin, without cookies.
  z.strictObject({ kind: z.literal('url'), url: z.url({ protocol: /^https?$/ }).max(4096) }),
  z.strictObject({
    kind: z.literal('pixels'),
    dataUrl: z.string().startsWith('data:image/jpeg;base64,').max(MAX_PIXELS_DATA_URL),
  }),
]);
export type MediaSource = z.infer<typeof mediaSourceSchema>;

export const contentRequestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('media/config') }),
  z.strictObject({ type: z.literal('media/classify'), source: mediaSourceSchema }),
]);
export type ContentRequest = z.infer<typeof contentRequestSchema>;

/**
 * blur: likely sensitive. show: likely safe. unverified: could not be checked (the content script
 * applies the user's fallback). busy: queue full, retry later.
 */
export const verdictSchema = z.enum(['blur', 'show', 'unverified', 'busy']);
export type Verdict = z.infer<typeof verdictSchema>;

export const filterSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  sensitivity: z.enum(SENSITIVITIES),
  /** What to do with media that cannot be checked (cross-origin video, DRM, decode failures). */
  unverifiable: z.enum(['blur', 'show']),
});
export type FilterSettings = z.infer<typeof filterSettingsSchema>;

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  enabled: false,
  sensitivity: 'balanced',
  unverifiable: 'blur',
};

export const contentConfigSchema = z.strictObject({
  enabled: z.boolean(),
  unverifiable: z.enum(['blur', 'show']),
});
export type ContentConfig = z.infer<typeof contentConfigSchema>;

export interface ContentResponseMap {
  'media/config': ContentConfig;
  'media/classify': { verdict: Verdict };
}

export const contentResponseSchemas = {
  'media/config': contentConfigSchema,
  'media/classify': z.strictObject({ verdict: verdictSchema }),
} as const;

/** Background → offscreen document. */
export const offscreenRequestSchema = z.strictObject({
  target: z.literal('offscreen'),
  type: z.literal('classify'),
  source: mediaSourceSchema,
});
export type OffscreenRequest = z.infer<typeof offscreenRequestSchema>;

export const offscreenResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    scores: z.strictObject({
      drawing: z.number(),
      hentai: z.number(),
      neutral: z.number(),
      porn: z.number(),
      sexy: z.number(),
    }),
  }),
  // vector: an SVG, which the model cannot read and which is treated as safe (logos, icons).
  z.strictObject({ ok: z.literal(false), reason: z.enum(['fetch', 'decode', 'vector', 'model']) }),
]);
export type OffscreenResponse = z.infer<typeof offscreenResponseSchema>;
