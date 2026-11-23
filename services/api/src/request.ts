/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { z } from 'zod';
import { ApiError } from './http';

const MAX_BODY_BYTES = 16 * 1024;

/** Parse and validate a JSON body. Invalid input never echoes back what was sent. */
export function parseBody<T extends z.ZodType>(
  event: APIGatewayProxyEventV2,
  schema: T,
): z.infer<T> {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
    : (event.body ?? '');
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new ApiError('VALIDATION_FAILED');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError('VALIDATION_FAILED');
  }
  return parseOrReject(schema, json);
}

export function parseOrReject<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError('VALIDATION_FAILED');
  return result.data;
}

export function header(event: APIGatewayProxyEventV2, name: string): string | undefined {
  return event.headers[name.toLowerCase()];
}
