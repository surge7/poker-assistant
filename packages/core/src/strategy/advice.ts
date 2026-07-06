import { equityPercent } from '../equity/equity';
import { evaluatePlayerHand } from '../eval/hand-eval';
import { totalOuts } from '../equity/outs';
import { compareToNuts } from '../eval/nuts';
import { isLatePosition } from './positions';
import type { TableContext, AdviceResult, Card } from '../types';
import { HandRank } from '../types';
import {
  FOLD_EQUITY_MULTIPLIER,
  FOLD_BAR_EARLY_PCT,
  FOLD_BAR_LATE_PCT,
  LOW_EQ_FOLD_MARGIN_EARLY,
  LOW_EQ_FOLD_MARGIN_LATE,
  MIN_EQ_NO_POTODDS_EARLY_PCT,
  MIN_EQ_NO_POTODDS_LATE_PCT,
  STRONG_EQ_NO_POTODDS_PCT,
  CALL_MARGIN_STRONG_PCT,
  CALL_MARGIN_OK_PCT,
  CALL_THRESHOLD_EARLY_PCT,
  CALL_THRESHOLD_LATE_PCT,
  CONFIDENCE,
} from '../config/thresholds';
import { PREMIUM_PAIR_MIN_RANK, BROADWAY_MIN_RANK } from '../config/preflop';
import { DEFAULT_ITERATIONS } from '../config/simulation';

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
  return r >= PREMIUM_PAIR_MIN_RANK; // J=9, Q=10, K=11, A=12
}

/**
 * На префлопе рука, которую по гайдам не фолдим «по слабости»:
 * только премиум-пара (AA–JJ) или две бродвей-карты (AK, AQ и т.д.) при хорошей эквити.
 */
function isPreflopNeverFoldWeak(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const r0 = RANK_ORDER[cards[0][0]] ?? -1;
  const r1 = RANK_ORDER[cards[1][0]] ?? -1;
  if (r0 === r1) return r0 >= PREMIUM_PAIR_MIN_RANK; // только AA, KK, QQ, JJ
  return r0 >= BROADWAY_MIN_RANK && r1 >= BROADWAY_MIN_RANK; // две бродвей-карты (T,J,Q,K,A)
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
    return { action: 'check', confidence: CONFIDENCE.invalid, reason: 'Введите свои две карты.' };
  }

  const strength = evaluatePlayerHand(holeCards, board);
  // Ауты имеют смысл только на флопе/терне; на ривере новых карт не будет.
  const { total: outs, improveChance } = board.length >= 3 && board.length < 5
    ? totalOuts(holeCards, board)
    : { total: 0, improveChance: 0 };
  const eq = eqFromCtx != null ? eqFromCtx : equityPercent(holeCards, board, numPlayers - 1, DEFAULT_ITERATIONS);
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
      confidence: CONFIDENCE.nuts,
      reason: isNuts ? 'У вас натс — максимизируйте банк.' : 'Очень сильная рука — рейз для значения.',
    };
  }

  // Префлоп: только премиум-пары (AA, KK, QQ, JJ) — по гайдам почти всегда играем
  if (phase === 'preflop' && isPremiumPocketPair(holeCards)) {
    return {
      action: toCall > 0 ? 'call' : 'raise',
      confidence: CONFIDENCE.premiumPreflop,
      reason: 'Премиум-пара на префлопе (AA–JJ) — рейз или колл для значения.',
    };
  }

  // Сильная рука
  if (strength.rank >= HandRank.TwoPair) {
    return {
      action: toCall > 0 ? 'call' : 'raise',
      confidence: CONFIDENCE.strongHand,
      reason: 'Сильная рука. Рейз или колл в зависимости от действия соперников.',
    };
  }

  // Рисы с хорошими пот-оддсами: шанс улучшения >= требуемой эквити (банк задан)
  if (outs >= 8 && hasPotOdds && improveChance >= requiredEquity) {
    const potNote = requiredEquityPct < 25 ? ' Банк большой относительно ставки — колл выгоден.' : '';
    return {
      action: 'call',
      confidence: CONFIDENCE.drawCall,
      reason: `Много аутов (${outs}), шансы улучшения оправдывают колл (нужно ~${Math.round(requiredEquityPct)}% эквити).${potNote}`,
    };
  }

  // Слабый дро без оддов: фолд, если эквити ниже порога (в поздней позиции порог ниже — чаще колл)
  // На префлопе не фолдим только премиум (AA–JJ) и бродвеи по «слабости»; мелкие пары (TT и ниже) — по эквити.
  const foldBarPct = toCall > 0 ? Math.max(requiredEquityPct * FOLD_EQUITY_MULTIPLIER, latePos ? FOLD_BAR_LATE_PCT : FOLD_BAR_EARLY_PCT) : 100;
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
      confidence: latePos ? CONFIDENCE.foldWeakHandLate : CONFIDENCE.foldWeakHandEarly,
      reason: `${weakHandNote}, эквити ~${eq}% при требуемых ~${Math.round(requiredEquityPct)}%.${latePos ? ' В поздней позиции можно было бы коллить шире.' : ''}${potNote}`,
    };
  }

  // Низкая эквити относительно пот-оддов: колл не окупается (в поздней позиции — чуть мягче)
  // На префлопе не фолдим по этому правилу только премиум (AA–JJ) и бродвеи
  const lowEqFoldMargin = latePos ? LOW_EQ_FOLD_MARGIN_LATE : LOW_EQ_FOLD_MARGIN_EARLY;
  if (
    !isPreflopNeverFold &&
    toCall > 0 &&
    eq < requiredEquityPct * lowEqFoldMargin
  ) {
    return {
      action: 'fold',
      confidence: isMarginal ? CONFIDENCE.foldLowEquityMarginal : CONFIDENCE.foldLowEquity,
      reason: `Эквити ~${eq}% ниже требуемых для колла (~${Math.round(requiredEquityPct)}%). При таком соотношении банк/ставка — фолд.${latePos ? ' Позиция немного смягчает.' : ''}${marginalNote}`,
    };
  }

  // Нет ставки на колл
  if (toCall === 0) {
    return {
      action: 'check',
      confidence: CONFIDENCE.check,
      reason: 'Нет ставки на колл. Чек и оценка дальнейших действий.',
    };
  }

  // Банк 0: пот-оддсы не считаем — совет только по эквити/силе руки (поздняя позиция — чуть мягче)
  if (!hasPotOdds) {
    const minEqForCall = latePos ? MIN_EQ_NO_POTODDS_LATE_PCT : MIN_EQ_NO_POTODDS_EARLY_PCT;
    if (eq >= STRONG_EQ_NO_POTODDS_PCT) {
      return {
        action: 'call',
        confidence: latePos ? CONFIDENCE.callNoPotOddsStrongLate : CONFIDENCE.callNoPotOddsStrong,
        reason: `Банк не указан — учёт пот-оддсов недоступен. Эквити ~${eq}%, по силе руки колл допустим.${latePos ? ' Позиция позволяет.' : ''}`,
      };
    }
    return {
      action: eq >= minEqForCall ? 'call' : 'fold',
      confidence: CONFIDENCE.callNoPotOddsWeak,
      reason: `Банк не указан — укажите банк для совета по коллу. Эквити ~${eq}%.${latePos && eq >= minEqForCall ? ' В поздней позиции колл допустим.' : ''}`,
    };
  }

  // Эквити достаточно для колла — чем больше запас над требуемой эквити, тем увереннее колл
  const margin = eq - requiredEquityPct;
  if (margin >= CALL_MARGIN_STRONG_PCT) {
    const posNote = latePos ? ' Позиция позволяет играть шире.' : '';
    const potNote = requiredEquityPct < 20 ? ' Банк даёт хорошие оддсы.' : '';
    return {
      action: 'call',
      confidence: latePos ? CONFIDENCE.callMarginStrongLate : CONFIDENCE.callMarginStrong,
      reason: `Эквити ~${eq}%, нужно ~${Math.round(requiredEquityPct)}%. Колл выгоден.${potNote}${posNote}`,
    };
  }
  if (margin >= CALL_MARGIN_OK_PCT) {
    const posNote = latePos ? ' В поздней позиции можно коллить.' : '';
    return {
      action: 'call',
      confidence: latePos ? CONFIDENCE.callMarginOkLate : CONFIDENCE.callMarginOk,
      reason: `Эквити ~${eq}% при требуемых ~${Math.round(requiredEquityPct)}%. Колл допустим.${posNote}`,
    };
  }

  // Близко к порогу — в поздней позиции допускаем колл при небольшом минусе по эквити
  const callThreshold = latePos ? CALL_THRESHOLD_LATE_PCT : CALL_THRESHOLD_EARLY_PCT;
  const posNote = latePos ? ' В поздней позиции можно рискнуть.' : '';
  return {
    action: margin >= callThreshold ? 'call' : 'fold',
    confidence: isMarginal ? CONFIDENCE.borderlineMarginal : CONFIDENCE.borderline,
    reason: `Эквити ~${eq}% при требуемых ~${Math.round(requiredEquityPct)}%.${posNote}${marginalNote}`,
  };
}
