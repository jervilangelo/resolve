/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { DOMAIN_SUBMISSIONS_PER_HOUR } from '@resolve/contracts';

/** At most one hour's worth of submissions per batch (the API charges each one). */
export const MAX_BULK_DOMAINS = DOMAIN_SUBMISSIONS_PER_HOUR;

/** Websites per server request: short requests, and little lost if one fails. */
export const BULK_CHUNK = 10;

/** Largest file read for bulk entry. */
export const MAX_BULK_FILE_BYTES = 2 * 1024 * 1024;

/** JSON object keys that hold a website, e.g. `[{ "domain": "example.com" }]`. */
const KEYS = ['domain', 'website', 'site', 'url', 'host', 'hostname'];

/**
 * A website from one entry: links become their host name ("https://www.x.com/a" → "x.com"),
 * entries without a dot (headers such as "Website", notes) are skipped. The server validates
 * every result again; this only makes pasted lists and exports friendlier.
 */
export function normalizeEntry(raw: string): string | null {
  let value = raw
    .trim()
    .replace(/^["'<([{]+|["'>)\]},;]+$/g, '')
    .toLowerCase();
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(value) || value.startsWith('//')) {
    try {
      value = new URL(value.startsWith('//') ? `https:${value}` : value).hostname;
    } catch {
      return null;
    }
  } else {
    value = value.split(/[/?#]/)[0] ?? '';
  }
  value = value
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');
  if (!value.includes('.') || !/^[a-z0-9.-]+$/.test(value) || value.length > 253) return null;
  return value;
}

function fromJson(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) fromJson(item, out);
  else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const key = KEYS.find((k) => typeof record[k] === 'string');
    if (key) out.push(record[key] as string);
    else for (const nested of Object.values(record)) fromJson(nested, out);
  }
}

/** Raw entries from text: JSON when it parses as JSON, otherwise lines, commas, tabs, spaces. */
export function entriesFromText(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const out: string[] = [];
      fromJson(JSON.parse(trimmed), out);
      return out;
    } catch {
      // Not JSON after all: read it as a list.
    }
  }
  return trimmed.split(/[\s,;]+/);
}

export interface BulkParse {
  /** Distinct websites, in the order first seen. */
  domains: string[];
  /** Entries that were not websites (headers, notes, malformed values). */
  skipped: number;
  /** Websites beyond MAX_BULK_DOMAINS, left out. */
  overflow: number;
}

/** Distinct normalized websites from raw entries. */
export function parseEntries(entries: readonly unknown[]): BulkParse {
  const seen = new Set<string>();
  let skipped = 0;
  for (const entry of entries) {
    if (entry === null || entry === undefined || entry === '') continue;
    const domain = typeof entry === 'string' ? normalizeEntry(entry) : null;
    if (domain) seen.add(domain);
    else skipped += 1;
  }
  const all = [...seen];
  return {
    domains: all.slice(0, MAX_BULK_DOMAINS),
    skipped,
    overflow: Math.max(0, all.length - MAX_BULK_DOMAINS),
  };
}
