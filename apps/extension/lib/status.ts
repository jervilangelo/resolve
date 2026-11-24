/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { FeatureId, Status } from './messages';

/** Features flip to available only when their implementation ships (roadmap phases 5–8). */
const AVAILABLE_FEATURES: Readonly<Record<FeatureId, boolean>> = {
  'ai-filter': false,
  'domain-protection': true,
  accountability: false,
};

export function buildStatus(version: string): Status {
  return {
    version,
    features: Object.entries(AVAILABLE_FEATURES).map(([id, available]) => ({
      id: id as FeatureId,
      available,
    })),
  };
}

export const FEATURE_LABELS: Readonly<Record<FeatureId, string>> = {
  'ai-filter': 'AI media blurring',
  'domain-protection': 'Domain protection',
  accountability: 'Accountability sharing',
};
