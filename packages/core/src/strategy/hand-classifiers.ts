/**
 * Классификаторы стартовых рук и борда.
 * Чистые функции — без побочных эффектов и состояния.
 */

import type { Card } from '../types';
import { PREMIUM_PAIR_MIN_RANK, BROADWAY_MIN_RANK } from '../config/preflop';

/** Числовое значение ранга (2=0, A=12). Синхронизировано с equity/outs.ts. */
const RANK_ORDER: Record<string, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5,
  '8': 6, '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
};

/** Карманная пара (две карты одного ранга). */
export function isPocketPair(cards: Card[]): boolean {
  return cards.length === 2 && cards[0][0] === cards[1][0];
}

/** Премиум-пара (TT, JJ, QQ, KK, AA). JJ — последняя «всегда играем». */
export function isPremiumPocketPair(cards: Card[]): boolean {
  if (cards.length !== 2 || cards[0][0] !== cards[1][0]) return false;
  const r = RANK_ORDER[cards[0][0]] ?? -1;
  return r >= PREMIUM_PAIR_MIN_RANK;
}

/**
 * На префлопе никогда не фолдим слабые руки:
 * - пара: JJ+ (премиум-пара, не фолдим по «слабости»)
 * - не-пара: обе карты бродвей (T–A)
 *
 * Пара TT здесь НЕ входит — это решение по «слабости» принимается
 * по эквити/пот-оддсам, а не по классификатору.
 */
export function isPreflopNeverFoldWeak(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const r0 = RANK_ORDER[cards[0][0]] ?? -1;
  const r1 = RANK_ORDER[cards[1][0]] ?? -1;
  if (r0 === r1) return r0 >= PREMIUM_PAIR_MIN_RANK;
  return r0 >= BROADWAY_MIN_RANK && r1 >= BROADWAY_MIN_RANK;
}
