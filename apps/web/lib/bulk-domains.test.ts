/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { describe, expect, it } from 'vitest';
import { MAX_BULK_DOMAINS, entriesFromText, normalizeEntry, parseEntries } from './bulk-domains';

describe('normalizeEntry', () => {
  it('turns links and decorated entries into host names', () => {
    expect(normalizeEntry('https://www.Example.com/path?q=1')).toBe('example.com');
    expect(normalizeEntry('  "news.example.org", ')).toBe('news.example.org');
    expect(normalizeEntry('example.net/some/page')).toBe('example.net');
    expect(normalizeEntry('//cdn.example.io:8443/x')).toBe('cdn.example.io');
    expect(normalizeEntry('example.com.')).toBe('example.com');
  });

  it('skips headers, notes and malformed values', () => {
    expect(normalizeEntry('Website')).toBeNull();
    expect(normalizeEntry('')).toBeNull();
    expect(normalizeEntry('bad_domain!.com')).toBeNull();
    expect(normalizeEntry('mailto:a@b.com')).toBeNull();
  });
});

describe('entriesFromText', () => {
  it('reads lines, commas, tabs and CSV exports', () => {
    const csv = 'Website,Note\nexample.com,work\n"https://other.org/a",\n';
    expect(parseEntries(entriesFromText(csv))).toEqual({
      domains: ['example.com', 'other.org'],
      skipped: 3,
      overflow: 0,
    });
    expect(parseEntries(entriesFromText('a.com\r\nb.com\tc.com; a.com')).domains).toEqual([
      'a.com',
      'b.com',
      'c.com',
    ]);
  });

  it('reads JSON arrays, objects with a website key, and nested lists', () => {
    expect(parseEntries(entriesFromText('["a.com", "https://b.com"]')).domains).toEqual([
      'a.com',
      'b.com',
    ]);
    const objects = '[{"domain":"a.com","note":"x.org"},{"url":"https://www.b.com/"}]';
    expect(parseEntries(entriesFromText(objects)).domains).toEqual(['a.com', 'b.com']);
    expect(
      parseEntries(entriesFromText('{"domains":["a.com"],"extra":{"site":"c.com"}}')).domains,
    ).toEqual(['a.com', 'c.com']);
  });

  it('falls back to a list when JSON is malformed', () => {
    expect(parseEntries(entriesFromText('[a.com, b.com')).domains).toEqual(['a.com', 'b.com']);
  });
});

describe('parseEntries', () => {
  it('dedupes and caps a batch at one hour of submissions', () => {
    const many = Array.from({ length: MAX_BULK_DOMAINS + 5 }, (_, i) => `site${String(i)}.com`);
    const parsed = parseEntries([...many, 'site0.com', 42]);
    expect(parsed.domains).toHaveLength(MAX_BULK_DOMAINS);
    expect(parsed.overflow).toBe(5);
    expect(parsed.skipped).toBe(1);
  });
});
