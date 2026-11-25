/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { canonicalRedirect } from './canonical-host';

const SITE = 'https://getresolved.site';
const url = (path: string) => new URL(path, 'https://internal.example');

describe('canonicalRedirect', () => {
  it('sends www to the apex, keeping path and query', () => {
    expect(canonicalRedirect(url('/dashboard?x=1'), 'www.getresolved.site', SITE)?.toString()).toBe(
      'https://getresolved.site/dashboard?x=1',
    );
  });

  it('sends the Amplify address to the custom domain', () => {
    expect(canonicalRedirect(url('/invite'), 'main.abc123.amplifyapp.com', SITE)?.toString()).toBe(
      'https://getresolved.site/invite',
    );
  });

  it('leaves the canonical host, unknown hosts and missing hosts alone', () => {
    expect(canonicalRedirect(url('/'), 'getresolved.site', SITE)).toBeNull();
    expect(canonicalRedirect(url('/'), 'GetResolved.site:443', SITE)).toBeNull();
    expect(canonicalRedirect(url('/'), 'internal.example', SITE)).toBeNull();
    expect(canonicalRedirect(url('/'), null, SITE)).toBeNull();
  });

  it('does nothing before the domain switch or in local development', () => {
    const amplify = 'https://main.abc123.amplifyapp.com';
    expect(canonicalRedirect(url('/'), 'main.abc123.amplifyapp.com', amplify)).toBeNull();
    expect(canonicalRedirect(url('/'), 'www.localhost', 'http://localhost:3000')).toBeNull();
  });
});
