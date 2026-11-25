/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import {
  dashboardRequestSchema,
  featureIdSchema,
  isDashboardOrigin,
  parseRequest,
  statusSchema,
} from './messages';
import { buildStatus } from './status';

describe('runtime messages', () => {
  it('accepts known requests only', () => {
    expect(parseRequest({ type: 'status/get' })).toEqual({ type: 'status/get' });
    expect(parseRequest({ type: 'status/get', extra: true })).toBeNull();
    expect(parseRequest({ type: 'unknown' })).toBeNull();
    expect(parseRequest('status/get')).toBeNull();
  });

  it('marks shipped features unavailable where the browser cannot run them', () => {
    const status = buildStatus('1.0.0', ['ai-filter', 'accountability']);
    expect(status.features.filter((f) => f.available).map((f) => f.id)).toEqual([
      'domain-protection',
    ]);
  });

  it('reports every feature, available only once it ships', () => {
    const status = buildStatus('1.0.0');
    expect(statusSchema.parse(status)).toEqual(status);
    expect(status.features.map((f) => f.id).sort()).toEqual([...featureIdSchema.options].sort());
    expect(status.features.filter((f) => f.available).map((f) => f.id)).toEqual([
      'ai-filter',
      'domain-protection',
      'accountability',
    ]);
  });
});

describe('dashboard checklist question', () => {
  it('is answered for the configured dashboard origin only', () => {
    const dashboard = 'https://getresolved.site/dashboard';
    expect(isDashboardOrigin('https://getresolved.site', dashboard)).toBe(true);
    expect(isDashboardOrigin('https://www.getresolved.site', dashboard)).toBe(false);
    expect(isDashboardOrigin('https://getresolved.site.evil.example', dashboard)).toBe(false);
    expect(isDashboardOrigin('http://getresolved.site', dashboard)).toBe(false);
    expect(isDashboardOrigin(undefined, dashboard)).toBe(false);
    expect(isDashboardOrigin('https://getresolved.site', undefined)).toBe(false);
  });

  it('accepts only the status question', () => {
    expect(dashboardRequestSchema.safeParse({ type: 'dashboard/status' }).success).toBe(true);
    expect(dashboardRequestSchema.safeParse({ type: 'account/get' }).success).toBe(false);
    expect(dashboardRequestSchema.safeParse({ type: 'dashboard/status', extra: 1 }).success).toBe(
      false,
    );
  });
});
