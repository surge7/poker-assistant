import { equityPercent } from './equity';
import { evaluatePlayerHand } from './hand-eval';
import { totalOuts } from './outs';
import { compareToNuts } from './nuts';
import type { TableContext } from './types';
import type { AdviceResult } from './types';
import { HandRank } from './types';

/** Поздняя позиция (BTN, CO) — можно играть шире. Ранняя (UTG, MP, SB, BB) — уже. */
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

  // Требуемая эквити для колла: колл оправдан, если эквити >= toCall/(pot+toCall).
  // Чем больше банк относительно ставки — тем ниже порог, тем выгоднее вписываться.
  // При банке 0 формула даёт 100% — не используем пот-оддсы для совета, только силу руки/эквити.
  const hasPotOdds = toCall > 0 && potSize > 0;
  const requiredEquity = hasPotOdds ? toCall / (potSize + toCall) : 0;
  const requiredEquityPct = requiredEquity * 100;

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

  // Рисы с хорошими пот-оддсами: шанс улучшения >= требуемой эквити (банк задан)
  if (outs >= 8 && hasPotOdds && improveChance >= requiredEquity) {
    const potNote = requiredEquityPct < 25 ? ' Банк большой относительно ставки — колл выгоден.' : '';
    return {
      action: 'call',
      confidence: 0.7,
      reason: `Много аутов (${outs}), шансы улучшения оправдывают колл (нужно ~${Math.round(requiredEquityPct)}% эквити).${potNote}`,
    };
  }

  // Слабый дро без оддов: фолд, если эквити ниже порога (в поздней позиции порог ниже — чаще колл)
  const foldBarPct = toCall > 0 ? Math.max(requiredEquityPct * 1.15, latePos ? 14 : 22) : 100;
  if (strength.rank <= HandRank.Pair && outs < 5 && toCall > 0 && eq < foldBarPct) {
    const potNote = requiredEquityPct > 40 ? ' Ставка велика относительно банка — фолд разумнее.' : '';
    return {
      action: 'fold',
      confidence: latePos ? 0.7 : 0.75,
      reason: `Слабая рука и мало аутов, эквити ~${eq}% при требуемых ~${Math.round(requiredEquityPct)}%.${latePos ? ' В поздней позиции можно было бы коллить шире.' : ''}${potNote}`,
    };
  }

  // Низкая эквити относительно пот-оддов: колл не окупается (в поздней позиции — чуть мягче)
  const lowEqFoldMargin = latePos ? 1.05 : 1.1;
  if (toCall > 0 && eq < requiredEquityPct * lowEqFoldMargin) {
    return {
      action: 'fold',
      confidence: 0.7,
      reason: `Эквити ~${eq}% ниже требуемых для колла (~${Math.round(requiredEquityPct)}%). При таком соотношении банк/ставка — фолд.${latePos ? ' Позиция немного смягчает.' : ''}`,
    };
  }

  // Нет ставки на колл
  if (toCall === 0) {
    return {
      action: 'check',
      confidence: 0.5,
      reason: 'Нет ставки на колл. Чек и оценка дальнейших действий.',
    };
  }

  // Банк 0: пот-оддсы не считаем — совет только по эквити/силе руки (поздняя позиция — чуть мягче)
  if (!hasPotOdds) {
    const minEqForCall = latePos ? 30 : 35;
    if (eq >= 50) {
      return {
        action: 'call',
        confidence: latePos ? 0.65 : 0.6,
        reason: `Банк не указан — учёт пот-оддсов недоступен. Эквити ~${eq}%, по силе руки колл допустим.${latePos ? ' Позиция позволяет.' : ''}`,
      };
    }
    return {
      action: eq >= minEqForCall ? 'call' : 'fold',
      confidence: 0.5,
      reason: `Банк не указан — укажите банк для совета по коллу. Эквити ~${eq}%.${latePos && eq >= minEqForCall ? ' В поздней позиции колл допустим.' : ''}`,
    };
  }

  // Эквити достаточно для колла — чем больше запас над требуемой эквити, тем увереннее колл
  const margin = eq - requiredEquityPct;
  if (margin >= 25) {
    const posNote = latePos ? ' Позиция позволяет играть шире.' : '';
    const potNote = requiredEquityPct < 20 ? ' Банк даёт хорошие оддсы.' : '';
    return {
      action: 'call',
      confidence: latePos ? 0.75 : 0.7,
      reason: `Эквити ~${eq}%, нужно ~${Math.round(requiredEquityPct)}%. Колл выгоден.${potNote}${posNote}`,
    };
  }
  if (margin >= 10) {
    const posNote = latePos ? ' В поздней позиции можно коллить.' : '';
    return {
      action: 'call',
      confidence: latePos ? 0.65 : 0.6,
      reason: `Эквити ~${eq}% при требуемых ~${Math.round(requiredEquityPct)}%. Колл допустим.${posNote}`,
    };
  }

  // Близко к порогу — в поздней позиции допускаем колл при небольшом минусе по эквити
  const callThreshold = latePos ? -5 : 0;
  const posNote = latePos ? ' В поздней позиции можно рискнуть.' : '';
  return {
    action: margin >= callThreshold ? 'call' : 'fold',
    confidence: 0.5,
    reason: `Эквити ~${eq}% при требуемых ~${Math.round(requiredEquityPct)}%.${posNote}`,
  };
}
