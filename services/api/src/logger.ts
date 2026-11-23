/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof LEVELS;

/**
 * Structured fields allowed in logs. Free-form request data (bodies, URLs, domains, headers,
 * tokens) is deliberately not representable, per docs/MASTER_PLAN.md §13.
 */
export interface LogFields {
  correlationId?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  errorCode?: string;
  errorName?: string;
}

export interface Logger {
  log(level: LogLevel, message: string, fields?: LogFields): void;
}

export function createLogger(
  minLevel: LogLevel,
  write: (line: string) => void = (line) => {
    process.stdout.write(`${line}\n`);
  },
): Logger {
  return {
    log(level, message, fields = {}) {
      if (LEVELS[level] < LEVELS[minLevel]) return;
      // Copy allowlisted keys only: a wider object can satisfy LogFields at compile time.
      const { correlationId, route, status, durationMs, errorCode, errorName } = fields;
      const entry = {
        level,
        message,
        correlationId,
        route,
        status,
        durationMs,
        errorCode,
        errorName,
      };
      write(JSON.stringify({ ...entry, time: new Date().toISOString() }));
    },
  };
}
