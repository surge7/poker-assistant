/**
 * Динамическая надёжность совета.
 *
 * Надёжность (confidence) — насколько однозначно решение при текущих данных.
 * Зависит от:
 * - категории руки (натс, премиум, сильная готовая, дефолт)
 * - наличия пот-оддсов и запаса/дефицита эквити относительно порога
 * - маргинальности (CI вокруг порога)
 *
 * Используется в AdviceResult.confidence — UI отображает это как "надёжность по данным".
 */

import type { AdviceResult } from '../types';
import {
  CONFIDENCE,
  RELIABILITY_MIN,
  RELIABILITY_MAX,
  RELIABILITY_FULL_GAP_PP,
  RELIABILITY_MARGINAL_CAP,
  RELIABILITY_NO_POT_ODDS_MIN,
  RELIABILITY_NO_POT_ODDS_MAX,
  RELIABILITY_CHECK,
  MIN_EQ_NO_POTODDS_LATE_PCT,
  MIN_EQ_NO_POTODDS_EARLY_PCT,
  STRONG_EQ_NO_POTODDS_PCT,
} from '../config/thresholds';

/** Категория руки — определяет потолок/дно надёжности. */
export type ReliabilityTier = 'nuts' | 'premium' | 'strong' | 'default';

/** Округлить надёжность до двух знаков с клипом [0, 1]. */
export function roundReliability(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
}

/**
 * Параметры расчёта надёжности.
 * - action: рекомендованное действие.
 * - gapPp: запас (если action=call) или дефицит (если action=fold) эквити в п.п. относительно порога.
 * - hasPotOdds: заданы ли пот-оддсы (pot>0 и toCall>0).
 * - isMarginal: попало ли решение в маргинальную зону (CI вокруг порога).
 * - tier: категория руки.
 * - eq: текущая эквити (нужна только при !hasPotOdds).
 * - latePos: в поздней ли позиции игрок.
 */
export interface ReliabilityParams {
  action: AdviceResult['action'];
  gapPp?: number;
  hasPotOdds: boolean;
  isMarginal: boolean;
  tier: ReliabilityTier;
  eq?: number;
  latePos?: boolean;
}

/**
 * Надёжность совета: насколько однозначно решение при текущих данных.
 * gapPp > 0 — запас в пользу рекомендованного действия.
 */
export function computeAdviceReliability(params: ReliabilityParams): number {
  const { action, gapPp, hasPotOdds, isMarginal, tier, eq, latePos } = params;

  if (tier === 'nuts') return CONFIDENCE.nuts;
  if (tier === 'premium') return CONFIDENCE.premiumPreflop;
  if (tier === 'strong') return CONFIDENCE.strongHand;

  if (action === 'check') return RELIABILITY_CHECK;

  if (!hasPotOdds && eq != null) {
    const minEq = latePos ? MIN_EQ_NO_POTODDS_LATE_PCT : MIN_EQ_NO_POTODDS_EARLY_PCT;
    const gap = action === 'call' ? eq - minEq : minEq - eq;
    const absGap = Math.max(0, gap);
    const span = RELIABILITY_NO_POT_ODDS_MAX - RELIABILITY_NO_POT_ODDS_MIN;
    let rel = RELIABILITY_NO_POT_ODDS_MIN + (Math.min(absGap, 25) / 25) * span;
    if (eq >= STRONG_EQ_NO_POTODDS_PCT && action === 'call') {
      rel = Math.max(rel, 0.5);
    }
    return roundReliability(rel);
  }

  const absGap = Math.max(0, gapPp ?? 0);
  let rel =
    RELIABILITY_MIN +
    (Math.min(absGap, RELIABILITY_FULL_GAP_PP) / RELIABILITY_FULL_GAP_PP) *
      (RELIABILITY_MAX - RELIABILITY_MIN);
  if (isMarginal) rel = Math.min(rel, RELIABILITY_MARGINAL_CAP);
  return roundReliability(rel);
}
