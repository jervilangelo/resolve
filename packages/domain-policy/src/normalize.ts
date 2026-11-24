/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { parse } from 'tldts';

/**
 * Domain input validation (docs/MASTER_PLAN.md §4.2). Accepts hostnames only: no URLs, paths,
 * ports, credentials, IP addresses, wildcards or patterns. A domain covers itself and all of its
 * subdomains.
 */
export type DomainRejection =
  'EMPTY' | 'NOT_A_HOSTNAME' | 'IP_ADDRESS' | 'INVALID_LABEL' | 'TOO_LONG' | 'PUBLIC_SUFFIX';

export type NormalizeResult = { ok: true; domain: string } | { ok: false; reason: DomainRejection };

const MAX_INPUT = 300;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/**
 * Canonical form: lower case, no surrounding whitespace, no trailing dot, internationalised names
 * in ASCII (punycode). Characters that would make this a URL rather than a hostname are rejected
 * instead of being silently stripped, so what is stored is exactly what was meant.
 */
export function normalizeDomain(input: string): NormalizeResult {
  const value = input.trim();
  if (value === '') return { ok: false, reason: 'EMPTY' };
  if (value.length > MAX_INPUT || /[\s/\\?#@:*%[\]]/.test(value)) {
    return { ok: false, reason: 'NOT_A_HOSTNAME' };
  }

  let ascii: string;
  try {
    // Exactly the browser's parsing (WHATWG URL, UTS #46): case folding, IDNA mapping (including
    // final sigma and ideographic full stops) and punycode, so stored rules match real hosts.
    ascii = new URL(`http://${value}`).hostname;
  } catch {
    return { ok: false, reason: 'NOT_A_HOSTNAME' };
  }
  if (ascii.endsWith('.')) ascii = ascii.slice(0, -1);

  const parsed = parse(ascii, { allowPrivateDomains: true });
  if (parsed.isIp) return { ok: false, reason: 'IP_ADDRESS' };
  if (ascii.length > 253) return { ok: false, reason: 'TOO_LONG' };
  const labels = ascii.split('.');
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label))) {
    return { ok: false, reason: 'INVALID_LABEL' };
  }
  // Blocking a public suffix (com, co.uk, github.io, ...) would block unrelated sites wholesale.
  if (!parsed.domain || parsed.publicSuffix === ascii) {
    return { ok: false, reason: 'PUBLIC_SUFFIX' };
  }
  return { ok: true, domain: ascii };
}

/** True when `host` is `domain` or one of its subdomains. Both must be normalised. */
export function coveredBy(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Normalises a hostname observed in the browser (e.g. from a navigation URL). Unlike
 * normalizeDomain it accepts any host the URL parser accepts, including public suffixes.
 */
export function normalizeHost(host: string): string | null {
  try {
    const hostname = new URL(`http://${host.trim()}`).hostname;
    return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
  } catch {
    return null;
  }
}
