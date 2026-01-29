import { equityPercent } from './equity';
import { evaluatePlayerHand } from './hand-eval';
import { totalOuts } from './outs';
import { compareToNuts } from './nuts';
import type { TableContext } from './types';
import type { AdviceResult } from './types';
import { HandRank } from './types';

/** Поздняя позиция (BTN, CO) — можно играть шире. Ранняя (UTG, MP) — уже. */
function isLatePosition(positionIndex: number, numPlayers: number): boolean {
  return positionIndex === 0 || positionIndex === numPlayers - 1;
}

/**
 * Простые советы на основе силы руки, эквити, аутов и позиции.
 * Не заменяет GTO; для обучения и подсказок в тренировочном режиме.
 */
export function getAdvice(ctx: TableContext): AdviceResult {
  const { phase, board, holeCards, potSize, toCall, numPlayers, positionIndex } = ctx;
  const latePos = isLatePosition(positionIndex, numPlayers);

  if (holeCards.length !== 2) {
    return { action: 'check', confidence: 0, reason: 'Введите свои две карты.' };
  }

  const strength = evaluatePlayerHand(holeCards, board);
  const { total: outs, improveChance } = totalOuts(holeCards, board);
  const eq = equityPercent(holeCards, board, numPlayers - 1, 300);
  const { isNuts } = compareToNuts(holeCards, board);

  const potOdds = toCall > 0 ? potSize / (potSize + toCall) : 1;

  // Натс или очень сильная рука
  if (isNuts || strength.rank >= HandRank.FullHouse) {
    return {
      action: 'raise',
      confidence: 0.95,
      reason: isNuts ? 'У вас натс — максимизируйте банк.' : 'Очень сильная рука — рейз для значения.',
    };
  }

  // Сильная рука
  if (strength.rank >= HandRank.TwoPair) {
    return {
      action: toCall > 0 ? 'call' : 'raise',
      confidence: 0.8,
      reason: 'Сильная рука. Рейз или колл в зависимости от действия соперников.',
    };
  }

  // Рисы с хорошими оддсами
  if (outs >= 8 && improveChance >= potOdds) {
    return {
      action: 'call',
      confidence: 0.7,
      reason: `Много аутов (${outs}), шансы улучшения оправдывают колл по пот-оддсам.`,
    };
  }

  // Слабый дро без оддов (в ранней позиции — строже)
  const foldThreshold = latePos ? 22 : 25;
  if (strength.rank <= HandRank.Pair && outs < 5 && toCall > 0 && eq < foldThreshold) {
    return {
      action: 'fold',
      confidence: latePos ? 0.7 : 0.75,
      reason: latePos
        ? 'Слабая рука и мало аутов. Фолд разумнее (в поздней позиции можно иногда коллить).'
        : 'Слабая рука и мало аутов. Фолд разумнее.',
    };
  }

  // Низкая эквити
  if (eq < 20 && toCall > potSize * 0.3) {
    return {
      action: 'fold',
      confidence: 0.7,
      reason: `Низкая эквити (~${eq}%). При большом колле — фолд.`,
    };
  }

  // Нейтрально: чек или колл
  if (toCall === 0) {
    return {
      action: 'check',
      confidence: 0.5,
      reason: 'Нет ставки на колл. Чек и оценка дальнейших действий.',
    };
  }

  if (eq >= 50) {
    const posNote = latePos ? ' Позиция позволяет играть шире.' : '';
    return { action: 'call', confidence: latePos ? 0.7 : 0.65, reason: `Эквити ~${eq}%. Колл допустим.${posNote}` };
  }

  const posNote = latePos ? ' В поздней позиции можно коллить шире.' : '';
  return {
    action: 'call',
    confidence: latePos ? 0.55 : 0.5,
    reason: `Эквити ~${eq}%. Решение по ситуации и стилю соперников.${posNote}`,
  };
}
