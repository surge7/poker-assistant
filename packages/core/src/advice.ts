import { equityPercent } from './equity';
import { evaluatePlayerHand } from './hand-eval';
import { totalOuts } from './outs';
import { compareToNuts } from './nuts';
import { isLatePosition } from './positions';
import type { TableContext, AdviceResult, Card } from './types';
import { HandRank } from './types';

const RANK_ORDER: Record<string, number> = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12 };

/** Карманная пара (две карты одного ранга). */
function isPocketPair(cards: Card[]): boolean {
  return cards.length === 2 && cards[0][0] === cards[1][0];
}

/**
 * Премиум-карманная пара на префлопе (AA, KK, QQ, JJ).
 * По гайдам: только такие пары «почти всегда играем»; TT и ниже — по ситуации и пот-оддсам.
 */
function isPremiumPocketPair(cards: Card[]): boolean {
  if (cards.length !== 2 || cards[0][0] !== cards[1][0]) return false;
  const r = RANK_ORDER[cards[0][0]] ?? -1;
  return r >= 9; // J=9, Q=10, K=11, A=12
}

/**
 * На префлопе рука, которую по гайдам не фолдим «по слабости»:
 * только премиум-пара (AA–JJ) или две бродвей-карты (AK, AQ и т.д.) при хорошей эквити.
 */
function isPreflopNeverFoldWeak(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const r0 = RANK_ORDER[cards[0][0]] ?? -1;
  const r1 = RANK_ORDER[cards[1][0]] ?? -1;
  if (r0 === r1) return r0 >= 9; // только AA, KK, QQ, JJ
  return r0 >= 8 && r1 >= 8; // две бродвей-карты (T,J,Q,K,A)
}

/**
 * Простые советы на основе силы руки, эквити, аутов и позиции.
 * Не заменяет GTO; для обучения и подсказок в тренировочном режиме.
 * Если в ctx передан equityPercent — он используется (один расчёт эквити в UI).
 */
export function getAdvice(ctx: TableContext): AdviceResult {
  const { phase, board, holeCards, potSize, toCall, numPlayers, positionIndex, equityPercent: eqFromCtx, equityLow, equityHigh } = ctx;
  const latePos = isLatePosition(positionIndex, numPlayers);

  if (holeCards.length !== 2) {
    return { action: 'check', confidence: 0, reason: 'Введите свои две карты.' };
  }

  const strength = evaluatePlayerHand(holeCards, board);
  // Ауты имеют смысл только на флопе/терне; на ривере новых карт не будет.
  const { total: outs, improveChance } = board.length >= 3 && board.length < 5
    ? totalOuts(holeCards, board)
    : { total: 0, improveChance: 0 };
  const eq = eqFromCtx != null ? eqFromCtx : equityPercent(holeCards, board, numPlayers - 1, 300);
  const { isNuts } = compareToNuts(holeCards, board);

  // Требуемая эквити для колла: колл оправдан, если эквити >= toCall/(pot+toCall).
  // Чем больше банк относительно ставки — тем ниже порог, тем выгоднее вписываться.
  // При банке 0 формула даёт 100% — не используем пот-оддсы для совета, только силу руки/эквити.
  const hasPotOdds = toCall > 0 && potSize > 0;
  const requiredEquity = hasPotOdds ? toCall / (potSize + toCall) : 0;
  const requiredEquityPct = requiredEquity * 100;

  // Маргинальность: требуемая эквити попадает в 95% CI расчётного эквити.
  // В этом случае выбор fold/call зависит от шума Монте-Карло — честно снижаем уверенность.
  const hasCI = equityLow != null && equityHigh != null;
  const isMarginal = hasPotOdds && hasCI && requiredEquityPct >= equityLow! && requiredEquityPct <= equityHigh!;
  const marginalNote = isMarginal ? ' Решение маргинально — эквити близко к порогу колла.' : '';

  // Натс или очень сильная рука
  if (isNuts || strength.rank >= HandRank.FullHouse) {
    return {
      action: 'raise',
      confidence: 0.95,
      reason: isNuts ? 'У вас натс — максимизируйте банк.' : 'Очень сильная рука — рейз для значения.',
    };
  }

  // Префлоп: только премиум-пары (AA, KK, QQ, JJ) — по гайдам почти всегда играем
  if (phase === 'preflop' && isPremiumPocketPair(holeCards)) {
    return {
      action: toCall > 0 ? 'call' : 'raise',
      confidence: 0.9,
      reason: 'Премиум-пара на префлопе (AA–JJ) — рейз или колл для значения.',
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
  // На префлопе не фолдим только премиум (AA–JJ) и бродвеи по «слабости»; мелкие пары (TT и ниже) — по эквити.
  const foldBarPct = toCall > 0 ? Math.max(requiredEquityPct * 1.15, latePos ? 14 : 22) : 100;
  const isPreflopNeverFold = phase === 'preflop' && isPreflopNeverFoldWeak(holeCards);
  if (
    !isPreflopNeverFold &&
    strength.rank <= HandRank.Pair &&
    outs < 5 &&
    toCall > 0 &&
    eq < foldBarPct
  ) {
    const potNote = requiredEquityPct > 40 ? ' Ставка велика относительно банка — фолд разумнее.' : '';
    // На ривере аутов не существует (карт больше не будет) — не упоминаем их в причине.
    const weakHandNote = board.length >= 5
      ? 'Слабая рука'
      : `Слабая рука и мало аутов`;
    return {
      action: 'fold',
      confidence: latePos ? 0.7 : 0.75,
      reason: `${weakHandNote}, эквити ~${eq}% при требуемых ~${Math.round(requiredEquityPct)}%.${latePos ? ' В поздней позиции можно было бы коллить шире.' : ''}${potNote}`,
    };
  }

  // Низкая эквити относительно пот-оддов: колл не окупается (в поздней позиции — чуть мягче)
  // На префлопе не фолдим по этому правилу только премиум (AA–JJ) и бродвеи
  const lowEqFoldMargin = latePos ? 1.05 : 1.1;
  if (
    !isPreflopNeverFold &&
    toCall > 0 &&
    eq < requiredEquityPct * lowEqFoldMargin
  ) {
    return {
      action: 'fold',
      confidence: isMarginal ? 0.55 : 0.7,
      reason: `Эквити ~${eq}% ниже требуемых для колла (~${Math.round(requiredEquityPct)}%). При таком соотношении банк/ставка — фолд.${latePos ? ' Позиция немного смягчает.' : ''}${marginalNote}`,
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
    confidence: isMarginal ? 0.4 : 0.5,
    reason: `Эквити ~${eq}% при требуемых ~${Math.round(requiredEquityPct)}%.${posNote}${marginalNote}`,
  };
}
