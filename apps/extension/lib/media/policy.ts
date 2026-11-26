/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Scores } from './classifier';

/**
 * How classifier output becomes a blur decision. The model reports five probabilities; the
 * explicit score adds the clearly explicit classes and, depending on sensitivity, a share of the
 * suggestive one. Thresholds come from the evaluation in docs/AI_FILTER_EVALUATION.md.
 */
export const SENSITIVITIES = ['strict', 'balanced', 'relaxed'] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

export const LEVELS: Record<Sensitivity, { sexyWeight: number; threshold: number }> = {
  strict: { sexyWeight: 1, threshold: 0.2 },
  balanced: { sexyWeight: 0.5, threshold: 0.35 },
  relaxed: { sexyWeight: 0, threshold: 0.6 },
};

export function explicitScore(scores: Scores, sensitivity: Sensitivity): number {
  return scores.porn + scores.hentai + LEVELS[sensitivity].sexyWeight * scores.sexy;
}

export function shouldBlur(scores: Scores, sensitivity: Sensitivity): boolean {
  return explicitScore(scores, sensitivity) >= LEVELS[sensitivity].threshold;
}
