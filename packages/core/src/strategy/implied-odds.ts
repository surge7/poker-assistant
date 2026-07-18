/**
 * Имплайд-оддсы: учёт потенциального выигрыша на следующих улицах.
 *
 * Применяется к:
 * - сет-майнингу (карманные пары 22–TT на префлопе, не премиум);
 * - сильному дро (8+ аутов на флопе);
 * - монстр-дро (13+ аутов, флеш+стрит).
 *
 * Возвращает коэффициент < 1.0, на который умножается requiredEquity:
 * factor=0.65 означает «требуемая эквити 65% от стандартной» (сет-майнинг).
 * Поздняя позиция смягчает скидку (1-0.4=0.6 от скидки для ранней — ранние позиции
 * теряют больше при неудачном сет-майнинге из-за позиции, поэтому скидка меньше).
 */

import type { Card } from '../types';
import {
  IMPLIED_PAIR_FACTOR,
  IMPLIED_STRONG_DRAW_FACTOR,
  IMPLIED_MONSTER_DRAW_FACTOR,
  IMPLIED_MONSTER_DRAW_OUTS,
} from '../config/thresholds';
import { isPocketPair, isPremiumPocketPair } from './hand-classifiers';

/** Фаза раздачи — 'preflop' | 'flop' | 'turn' | 'river' (GamePhase из types.ts). */
export type ImpliedPhase = 'preflop' | 'flop' | 'turn' | 'river';

/** Результат: коэффициент < 1.0 и причина (если имплайды не применяются, factor=1.0, reason=''). */
export interface ImpliedResult {
  factor: number;
  reason: string;
}

/** Проверить, нужно ли применять имплайды, и вернуть коэффициент + причину. */
export function computeImpliedFactor(
  phase: ImpliedPhase,
  holeCards: Card[],
  board: Card[],
  outs: number,
  latePos: boolean,
): ImpliedResult {
  // Сет-майнинг: карманная пара 22–TT (не премиум) на префлопе.
  // Сет ~11.8%, но выигрыш превышает колл в несколько раз при глубоком SPR.
  if (phase === 'preflop' && isPocketPair(holeCards) && !isPremiumPocketPair(holeCards)) {
    const discount = latePos ? 1 - IMPLIED_PAIR_FACTOR : (1 - IMPLIED_PAIR_FACTOR) * 0.4;
    return { factor: 1 - discount, reason: 'сет-майнинг' };
  }

  // Постфлоп: сильное/монстр-дро (3 или 4 карты борда).
  if (board.length >= 3 && board.length < 5) {
    if (outs >= IMPLIED_MONSTER_DRAW_OUTS) {
      const discount = latePos
        ? 1 - IMPLIED_MONSTER_DRAW_FACTOR
        : (1 - IMPLIED_MONSTER_DRAW_FACTOR) * 0.5;
      return { factor: 1 - discount, reason: 'монстр-дро' };
    }
    if (outs >= 8) {
      const discount = latePos
        ? 1 - IMPLIED_STRONG_DRAW_FACTOR
        : (1 - IMPLIED_STRONG_DRAW_FACTOR) * 0.5;
      return { factor: 1 - discount, reason: 'сильное дро' };
    }
  }

  return { factor: 1.0, reason: '' };
}
