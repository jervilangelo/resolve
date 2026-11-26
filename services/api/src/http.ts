/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { type ApiErrorResponse, ERROR_STATUS, type ErrorCode } from '@resolve/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { getEnv } from './env';
import { type Logger, createLogger } from './logger';

/** Generic, content-free messages (docs/MASTER_PLAN.md §11). */
const MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Authentication required.',
  FORBIDDEN: 'Forbidden.',
  NOT_FOUND: 'Not found.',
  CONFLICT: 'Conflict.',
  VALIDATION_FAILED: 'Validation failed.',
  RATE_LIMITED: 'Too many requests.',
  INTERNAL: 'Internal error.',
};

/** Throw from a route to return a contract error response. */
export class ApiError extends Error {
  constructor(readonly code: ErrorCode) {
    super(MESSAGES[code]);
    this.name = 'ApiError';
  }
}

export interface RouteContext {
  correlationId: string;
  logger: Logger;
}

export interface RouteResult {
  status: number;
  body: unknown;
}

export type Route = (event: APIGatewayProxyEventV2, context: RouteContext) => Promise<RouteResult>;

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

function respond(
  status: number,
  body: unknown,
  correlationId: string,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: { ...JSON_HEADERS, 'x-correlation-id': correlationId },
    body: JSON.stringify(body),
  };
}

/**
 * Wraps a route with environment validation, correlation IDs, structured logging and the shared
 * error contract. Unexpected errors become a generic 500 and are logged by name only.
 */
export function createHandler(name: string, route: Route, logger?: Logger) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    const started = Date.now();
    // The API Gateway request ID is server-generated, so it cannot be spoofed by clients.
    const correlationId = event.requestContext.requestId;
    // Fallback until the environment validates, so configuration errors are still logged.
    let log = logger ?? createLogger('info');
    let response: APIGatewayProxyStructuredResultV2;
    try {
      const env = getEnv();
      log = logger ?? createLogger(env.LOG_LEVEL);
      const result = await route(event, { correlationId, logger: log });
      response = respond(result.status, result.body, correlationId);
    } catch (error) {
      const code: ErrorCode = error instanceof ApiError ? error.code : 'INTERNAL';
      if (code === 'INTERNAL') {
        log.log('error', 'Unhandled error', {
          correlationId,
          route: event.routeKey || name,
          errorName: errorName(error),
        });
      }
      const body: ApiErrorResponse = { error: { code, message: MESSAGES[code], correlationId } };
      response = respond(ERROR_STATUS[code], body, correlationId);
    }
    log.log('info', 'Request completed', {
      correlationId,
      route: event.routeKey || name,
      status: response.statusCode,
      durationMs: Date.now() - started,
    });
    return response;
  };
}

/** Error class names only, never messages; anything unusual collapses to a fixed value. */
function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  return /^(?:[A-Z][A-Za-z]{0,40})?Error$/.test(name) ? name : 'UnknownError';
}
