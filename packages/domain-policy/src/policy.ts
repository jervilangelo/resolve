/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { ESSENTIAL_DOMAINS, essentialFor, essentialsUnder } from './essential';
import { type DomainRejection, coveredBy, normalizeDomain, normalizeHost } from './normalize';

export type DomainType = 'NON_NEGOTIABLE' | 'ADDITIONAL';
export type Decision = 'ALLOW' | 'BLOCK_NON_NEGOTIABLE' | 'BLOCK_ADDITIONAL';

export interface GroupPolicy {
  nonNegotiable: readonly string[];
  additional: readonly string[];
}

/**
 * Precedence (docs/MASTER_PLAN.md §4.1): essential exemption, then non-negotiable, then
 * additional, otherwise allow. `host` may be any hostname seen in the browser.
 */
export function decide(host: string, policy: GroupPolicy): Decision {
  const normalized = normalizeHost(host);
  if (!normalized) return 'ALLOW';
  if (essentialFor(normalized)) return 'ALLOW';
  if (policy.nonNegotiable.some((d) => coveredBy(normalized, d))) return 'BLOCK_NON_NEGOTIABLE';
  if (policy.additional.some((d) => coveredBy(normalized, d))) return 'BLOCK_ADDITIONAL';
  return 'ALLOW';
}

export type ValidationResult =
  | {
      ok: true;
      domain: string;
      /** Essential services under this domain that stay reachable despite the block. */
      exempted: string[];
    }
  | { ok: false; reason: DomainRejection | 'ESSENTIAL' };

/**
 * Validates a domain submitted for a group blocklist. Essential services themselves (and their
 * subdomains) cannot be blocked; a broader domain may be, with the essential hosts beneath it
 * staying reachable through the higher-priority exemption.
 */
export function validateBlockedDomain(input: string): ValidationResult {
  const normalized = normalizeDomain(input);
  if (!normalized.ok) return normalized;
  if (essentialFor(normalized.domain)) return { ok: false, reason: 'ESSENTIAL' };
  const exempted = [...new Set(essentialsUnder(normalized.domain).map((e) => e.service))];
  return { ok: true, domain: normalized.domain, exempted };
}

export const essentialDomains = (): string[] => ESSENTIAL_DOMAINS.map((e) => e.domain);
