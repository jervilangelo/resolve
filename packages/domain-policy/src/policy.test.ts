/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import {
  ESSENTIAL_DOMAINS,
  coveredBy,
  decide,
  normalizeDomain,
  normalizeHost,
  validateBlockedDomain,
} from './index';

describe('normalizeDomain', () => {
  it.each([
    ['Example.COM', 'example.com'],
    ['  example.com.  ', 'example.com'],
    ['sub.example.co.uk', 'sub.example.co.uk'],
    ['bücher.example', 'xn--bcher-kva.example'],
    ['münchen.de', 'xn--mnchen-3ya.de'],
    ['xn--mnchen-3ya.de', 'xn--mnchen-3ya.de'],
    ['my-site.github.io', 'my-site.github.io'],
    ['ΟΣ-test.gr', 'xn---test-qce2a.gr'],
    ['example.com。', 'example.com'],
    ['XN--MNCHEN-3YA.DE', 'xn--mnchen-3ya.de'],
  ])('%j -> %s', (input, expected) => {
    expect(normalizeDomain(input)).toEqual({ ok: true, domain: expected });
  });

  it.each([
    ['', 'EMPTY'],
    ['   ', 'EMPTY'],
    ['https://example.com', 'NOT_A_HOSTNAME'],
    ['example.com/path', 'NOT_A_HOSTNAME'],
    ['example.com:8080', 'NOT_A_HOSTNAME'],
    ['user@example.com', 'NOT_A_HOSTNAME'],
    ['*.example.com', 'NOT_A_HOSTNAME'],
    ['exa mple.com', 'NOT_A_HOSTNAME'],
    ['example.com?x', 'NOT_A_HOSTNAME'],
    ['example.com\\x', 'NOT_A_HOSTNAME'],
    ['192.168.0.1', 'IP_ADDRESS'],
    ['[::1]', 'NOT_A_HOSTNAME'],
    ['localhost', 'INVALID_LABEL'],
    ['-bad.example.com', 'INVALID_LABEL'],
    ['a..example.com', 'INVALID_LABEL'],
    [`${'a'.repeat(64)}.com`, 'INVALID_LABEL'],
    ['com', 'INVALID_LABEL'],
    ['co.uk', 'PUBLIC_SUFFIX'],
    ['github.io', 'PUBLIC_SUFFIX'],
    ['blogspot.com', 'PUBLIC_SUFFIX'],
  ])('rejects %j as %s', (input, reason) => {
    expect(normalizeDomain(input)).toEqual({ ok: false, reason });
  });
});

describe('validateBlockedDomain', () => {
  it('refuses to block essential services or their subdomains', () => {
    for (const { domain } of ESSENTIAL_DOMAINS) {
      expect(validateBlockedDomain(domain)).toEqual({ ok: false, reason: 'ESSENTIAL' });
      expect(validateBlockedDomain(`x.${domain}`)).toEqual({ ok: false, reason: 'ESSENTIAL' });
    }
  });

  it('allows a broader domain and reports the essentials kept reachable beneath it', () => {
    const result = validateBlockedDomain('google.com');
    expect(result).toMatchObject({ ok: true, domain: 'google.com' });
    expect(result.ok && [...result.exempted].sort()).toEqual([
      'Gmail',
      'Google Drive',
      'Google Meet',
      'Google account',
    ]);
    expect(validateBlockedDomain('example.com')).toEqual({
      ok: true,
      domain: 'example.com',
      exempted: [],
    });
  });

  it('keeps Microsoft 365 hosts reachable under cloud.microsoft', () => {
    const result = validateBlockedDomain('cloud.microsoft');
    expect(result.ok && [...result.exempted].sort()).toEqual([
      'Microsoft 365',
      'Microsoft Teams',
      'Outlook',
    ]);
    const policy = { nonNegotiable: ['cloud.microsoft'], additional: [] };
    expect(decide('teams.cloud.microsoft', policy)).toBe('ALLOW');
    expect(decide('outlook.cloud.microsoft', policy)).toBe('ALLOW');
    expect(decide('other.cloud.microsoft', policy)).toBe('BLOCK_NON_NEGOTIABLE');
  });

  it('agrees with browser hostname parsing for stored rules', () => {
    for (const input of ['ΟΣ-test.gr', 'Bücher.example', 'example.com。']) {
      const stored = normalizeDomain(input);
      expect(stored.ok && normalizeHost(input)).toBe(stored.ok && stored.domain);
    }
  });

  it('does not treat look-alike hosts as essential', () => {
    expect(validateBlockedDomain('notfacebook.com')).toMatchObject({ ok: true });
    expect(validateBlockedDomain('facebook.com.evil.example')).toMatchObject({ ok: true });
  });
});

describe('decide (precedence)', () => {
  const policy = {
    nonNegotiable: ['blocked.example', 'google.com'],
    additional: ['extra.example', 'blocked.example'],
  };

  it.each([
    ['mail.google.com', 'ALLOW'],
    ['accounts.google.com', 'ALLOW'],
    ['www.youtube.com', 'ALLOW'],
    ['google.com', 'BLOCK_NON_NEGOTIABLE'],
    ['news.google.com', 'BLOCK_NON_NEGOTIABLE'],
    ['blocked.example', 'BLOCK_NON_NEGOTIABLE'],
    ['a.b.blocked.example', 'BLOCK_NON_NEGOTIABLE'],
    ['extra.example', 'BLOCK_ADDITIONAL'],
    ['WWW.Extra.Example.', 'BLOCK_ADDITIONAL'],
    ['notblocked.example', 'ALLOW'],
    ['example', 'ALLOW'],
  ])('%s -> %s', (host, expected) => {
    expect(decide(host, policy)).toBe(expected);
  });
});

describe('coveredBy', () => {
  it('matches the domain and its subdomains only', () => {
    expect(coveredBy('a.example.com', 'example.com')).toBe(true);
    expect(coveredBy('example.com', 'example.com')).toBe(true);
    expect(coveredBy('badexample.com', 'example.com')).toBe(false);
  });
});
