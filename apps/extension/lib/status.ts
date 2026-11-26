/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { FeatureId, Status } from './messages';

/** Features flip to available only when their implementation ships (roadmap phases 5–8). */
const AVAILABLE_FEATURES: Readonly<Record<FeatureId, boolean>> = {
  'ai-filter': true,
  'domain-protection': true,
  accountability: true,
};

/**
 * `unsupported` lists shipped features this browser cannot run (e.g. Firefox has no offscreen
 * documents for the media filter and no declared permission for blocked-visit alerts).
 */
export function buildStatus(version: string, unsupported: readonly FeatureId[] = []): Status {
  return {
    version,
    features: Object.entries(AVAILABLE_FEATURES).map(([id, available]) => ({
      id: id as FeatureId,
      available: available && !unsupported.includes(id as FeatureId),
    })),
  };
}

export const FEATURE_LABELS: Readonly<Record<FeatureId, string>> = {
  'ai-filter': 'Media blurring',
  'domain-protection': 'Website blocking',
  accountability: 'Blocked-visit alerts',
};
