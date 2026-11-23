/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { apiErrorResponseSchema, healthResponseSchema } from '@resolve/contracts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createHandler } from './http';
import { createLogger } from './logger';

function event(): APIGatewayProxyEventV2 {
  return {
    rawPath: '/v1/test',
    body: '{"domain":"secret.example"}',
    requestContext: { requestId: 'req-123' },
  } as unknown as APIGatewayProxyEventV2;
}

function capture() {
  const lines: string[] = [];
  return { lines, logger: createLogger('debug', (line) => lines.push(line)) };
}

describe('createHandler', () => {
  beforeEach(() => {
    vi.stubEnv('STAGE', 'test');
  });

  it('serves the health contract', async () => {
    const { handler } = await import('./handlers/health');
    const res = await handler(event());
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['x-correlation-id']).toBe('req-123');
    expect(healthResponseSchema.parse(JSON.parse(res.body ?? ''))).toEqual({
      status: 'ok',
      service: 'resolve-api',
      stage: 'test',
    });
  });

  it('maps ApiError to the contract status and generic message', async () => {
    const { logger } = capture();
    const handler = createHandler('t', () => Promise.reject(new ApiError('NOT_FOUND')), logger);
    const res = await handler(event());
    expect(res.statusCode).toBe(404);
    const body = apiErrorResponseSchema.parse(JSON.parse(res.body ?? ''));
    expect(body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Not found.',
      correlationId: 'req-123',
    });
  });

  it('hides unexpected errors and never logs request content or error messages', async () => {
    const { lines, logger } = capture();
    const handler = createHandler(
      't',
      () => Promise.reject(new Error('failed for secret.example')),
      logger,
    );
    const res = await handler(event());
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret.example');
    expect(lines.join('\n')).not.toContain('secret.example');
    expect(lines.some((line) => line.includes('"errorName":"Error"'))).toBe(true);
  });

  it('drops non-allowlisted log fields even when passed at runtime', () => {
    const { lines, logger } = capture();
    const fields = { correlationId: 'c', body: 'secret.example' };
    logger.log('info', 'm', fields);
    expect(lines[0]).not.toContain('secret.example');
    expect(lines[0]).toContain('"correlationId":"c"');
  });

  it('returns the error contract when the response cannot be serialized', async () => {
    const { logger } = capture();
    const handler = createHandler('t', () => Promise.resolve({ status: 200, body: 1n }), logger);
    const res = await handler(event());
    expect(res.statusCode).toBe(500);
    expect(res.headers?.['x-correlation-id']).toBe('req-123');
  });
});
