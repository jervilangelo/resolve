/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import 'server-only';
import { type ErrorCode, apiErrorResponseSchema } from '@resolve/contracts';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import { getSession } from './auth';
import { serverEnv } from './server-env';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'UNKNOWN',
  ) {
    super(`API request failed: ${code}`);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

/** Calls the Resolve API as the signed-in user and validates the response against `schema`. */
export async function api<T extends z.ZodType>(
  path: `/v1/${string}`,
  schema: T,
  options: RequestOptions = {},
): Promise<z.infer<T>> {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  const res = await fetch(new URL(path, serverEnv().RESOLVE_API_URL), {
    method: options.method ?? 'GET',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      ...(options.body !== undefined && { 'content-type': 'application/json' }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });

  if (res.status === 401) redirect('/auth/login');
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorResponseSchema.safeParse(json);
    throw new ApiRequestError(res.status, parsed.success ? parsed.data.error.code : 'UNKNOWN');
  }
  return schema.parse(json);
}
