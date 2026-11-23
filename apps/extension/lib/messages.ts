/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';

/**
 * Typed runtime messages between extension contexts. Every message received by the background
 * worker is validated, because content scripts run alongside untrusted pages.
 */
export const requestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('status/get') }),
]);
export type Request = z.infer<typeof requestSchema>;

/** Protection features and whether this build ships them. */
export const featureIdSchema = z.enum(['ai-filter', 'domain-protection', 'accountability']);
export type FeatureId = z.infer<typeof featureIdSchema>;

export const statusSchema = z.strictObject({
  version: z.string(),
  features: z.array(z.strictObject({ id: featureIdSchema, available: z.boolean() })),
});
export type Status = z.infer<typeof statusSchema>;

export interface ResponseMap {
  'status/get': Status;
}

export function parseRequest(message: unknown): Request | null {
  const result = requestSchema.safeParse(message);
  return result.success ? result.data : null;
}
