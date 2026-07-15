import { equityPercent } from '../equity/equity';
import { evaluatePlayerHand } from '../eval/hand-eval';
import { totalOuts } from '../equity/outs';
import { compareToNuts } from '../eval/nuts';
import { isLatePosition } from './positions';
import type { TableContext, AdviceResult, AdviceExplanation, Card } from '../types';
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
  RELIABILITY_MIN,
  RELIABILITY_MAX,
  RELIABILITY_FULL_GAP_PP,
  RELIABILITY_MARGINAL_CAP,
  RELIABILITY_NO_POT_ODDS_MIN,
  RELIABILITY_NO_POT_ODDS_MAX,
  RELIABILITY_CHECK,
  PFR_BASE,
  PFR_MODIFIER_SENSITIVITY,
  PFR_MODIFIER_MIN,
  PFR_MODIFIER_MAX,
  IMPLIED_PAIR_FACTOR,
  IMPLIED_STRONG_DRAW_FACTOR,
  IMPLIED_MONSTER_DRAW_FACTOR,
  IMPLIED_MONSTER_DRAW_OUTS,
} from '../config/thresholds';
import { PREMIUM_PAIR_MIN_RANK, BROADWAY_MIN_RANK } from '../config/preflop';
import { DEFAULT_ITERATIONS } from '../config/simulation';
import { messages, fmt } from '../i18n';

const RANK_ORDER: Record<string, number> = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12 };

function adviceResult(
  action: AdviceResult['action'],
  confidence: number,
  reason: string,
  explanation: AdviceExplanation,
  ...details: (string | false | undefined)[]
): AdviceResult {
  const list = details.filter((d): d is string => typeof d === 'string' && d.length > 0);
  return list.length > 0
    ? { action, confidence, reason, explanation, details: list }
    : { action, confidence, reason, explanation };
}

function buildExplanation(params: {
  eq: number;
  equityLow?: number;
  equityHigh?: number;
  hasPotOdds: boolean;
  potSize: number;
  toCall: number;
  requiredEquityPct: number;
  effectiveRequiredEquityPct: number;
  outs: number;
  improveChance: number;
  impliedFactor: number;
  impliedReason: string;
  isMarginal: boolean;
  boardLength: number;
}): AdviceExplanation {
  const {
    eq,
    equityLow,
    equityHigh,
    hasPotOdds,
    potSize,
    toCall,
    requiredEquityPct,
    effectiveRequiredEquityPct,
    outs,
    improveChance,
    impliedFactor,
    impliedReason,
    isMarginal,
    boardLength,
  } = params;

  const explanation: AdviceExplanation = { equityPct: eq };

  if (equityLow != null && equityHigh != null) {
    explanation.equityLow = equityLow;
    explanation.equityHigh = equityHigh;
  }

  if (hasPotOdds) {
    explanation.requiredPct = Math.round(requiredEquityPct * 10) / 10;
    explanation.effectiveRequiredPct = Math.round(effectiveRequiredEquityPct * 10) / 10;
    explanation.marginPct = Math.round((eq - effectiveRequiredEquityPct) * 10) / 10;
    explanation.potOdds = Math.round((toCall / (potSize + toCall)) * 1000) / 1000;
    explanation.potSize = potSize;
    explanation.toCall = toCall;
  } else if (toCall > 0 && potSize <= 0) {
    explanation.potOddsUnavailable = true;
  }

  if (boardLength >= 3 && boardLength < 5 && outs > 0) {
    explanation.outs = outs;
    explanation.improveChancePct = Math.round(improveChance * 1000) / 10;
  }

  if (impliedFactor < 1.0) {
    explanation.impliedOdds = impliedFactor;
    explanation.impliedReason = impliedReason;
  }

  if (isMarginal) {
    explanation.isMarginal = true;
  }

  return explanation;
}

/** Карманная пара (две карты одного ранга). */
function isPocketPair(cards: Card[]): boolean {
  return cards.length === 2 && cards[0][0] === cards[1][0];
}

function isPremiumPocketPair(cards: Card[]): boolean {
  if (cards.length !== 2 || cards[0][0] !== cards[1][0]) return false;
  const r = RANK_ORDER[cards[0][0]] ?? -1;
  return r >= PREMIUM_PAIR_MIN_RANK;
}

function isPreflopNeverFoldWeak(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const r0 = RANK_ORDER[cards[0][0]] ?? -1;
  const r1 = RANK_ORDER[cards[1][0]] ?? -1;
  if (r0 === r1) return r0 >= PREMIUM_PAIR_MIN_RANK;
  return r0 >= BROADWAY_MIN_RANK && r1 >= BROADWAY_MIN_RANK;
}

function clampPfr(v: number): number {
  return Math.max(PFR_MODIFIER_MIN, Math.min(PFR_MODIFIER_MAX, v));
}

type ReliabilityTier = 'nuts' | 'premium' | 'strong' | 'default';

function roundReliability(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
}

/**
 * Надёжность совета: насколько однозначно решение при текущих данных.
 * gapPp > 0 — запас в пользу рекомендованного действия (эквити выше порога для колла,
 * ниже порога для фолда).
 */
function computeAdviceReliability(params: {
  action: AdviceResult['action'];
  gapPp?: number;
  hasPotOdds: boolean;
  isMarginal: boolean;
  tier: ReliabilityTier;
  eq?: number;
  latePos?: boolean;
}): number {
  const { action, gapPp, hasPotOdds, isMarginal, tier, eq, latePos } = params;

  if (tier === 'nuts') return CONFIDENCE.nuts;
  if (tier === 'premium') return CONFIDENCE.premiumPreflop;
  if (tier === 'strong') return CONFIDENCE.strongHand;

  if (action === 'check') return RELIABILITY_CHECK;

  if (!hasPotOdds && eq != null) {
    const minEq = latePos ? MIN_EQ_NO_POTODDS_LATE_PCT : MIN_EQ_NO_POTODDS_EARLY_PCT;
    const gap =
      action === 'call'
        ? eq - minEq
        : minEq - eq;
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

/**
 * Простые советы на основе силы руки, эквити, аутов и позиции.
 * Позиция влияет на пороги решения, но не озвучивается в тексте совета.
 *
 * Формулировки (reason/details) хранятся в i18n/ (ru.ts, en.ts).
 * Чтобы поменять текст совета, правьте словарь, а не эту функцию.
 * Локаль переключается через setLocale('ru' | 'en').
 */
export function getAdvice(ctx: TableContext): AdviceResult {
  const { phase, board, holeCards, potSize, toCall, numPlayers, positionIndex, equityPercent: eqFromCtx, equityLow, equityHigh } = ctx;
  const latePos = isLatePosition(positionIndex, numPlayers);

  // Текущая локаль сообщений совета. Переключается через setLocale() (см. i18n/).
  const M = messages();

  if (holeCards.length !== 2) {
    return { action: 'check', confidence: CONFIDENCE.invalid, reason: M.reason.needTwoCards };
  }

  const strength = evaluatePlayerHand(holeCards, board);
  const { total: outs, improveChance } = board.length >= 3 && board.length < 5
    ? totalOuts(holeCards, board)
    : { total: 0, improveChance: 0 };
  const eq = eqFromCtx != null ? eqFromCtx : equityPercent(holeCards, board, numPlayers - 1, DEFAULT_ITERATIONS);
  const { isNuts } = compareToNuts(holeCards, board);

  const hasPotOdds = toCall > 0 && potSize > 0;
  const requiredEquity = hasPotOdds ? toCall / (potSize + toCall) : 0;
  const requiredEquityPct = requiredEquity * 100;

  const hasCI = equityLow != null && equityHigh != null;
  const isMarginal = hasPotOdds && hasCI && requiredEquityPct >= equityLow! && requiredEquityPct <= equityHigh!;

  const activeOpp = ctx.opponents?.[ctx.activeOpponentIndex ?? -1];
  const activePfr = activeOpp?.stats && activeOpp.stats.pfr > 0 ? activeOpp.stats.pfr : PFR_BASE;
  const pfrModifier = clampPfr(1 + (PFR_BASE - activePfr) * PFR_MODIFIER_SENSITIVITY);
  const oppDetail =
    pfrModifier > 1.05
      ? fmt(M.details.oppTight, { activePfr })
      : pfrModifier < 0.95
      ? fmt(M.details.oppAggressive, { activePfr })
      : undefined;

  let impliedFactor = 1.0;
  let impliedReason = '';
  if (phase === 'preflop' && isPocketPair(holeCards) && !isPremiumPocketPair(holeCards)) {
    const discount = latePos ? (1 - IMPLIED_PAIR_FACTOR) : (1 - IMPLIED_PAIR_FACTOR) * 0.4;
    impliedFactor = 1 - discount;
    impliedReason = 'сет-майнинг';
  } else if (board.length >= 3 && board.length < 5) {
    if (outs >= IMPLIED_MONSTER_DRAW_OUTS) {
      const discount = latePos ? (1 - IMPLIED_MONSTER_DRAW_FACTOR) : (1 - IMPLIED_MONSTER_DRAW_FACTOR) * 0.5;
      impliedFactor = 1 - discount;
      impliedReason = 'монстр-дро';
    } else if (outs >= 8) {
      const discount = latePos ? (1 - IMPLIED_STRONG_DRAW_FACTOR) : (1 - IMPLIED_STRONG_DRAW_FACTOR) * 0.5;
      impliedFactor = 1 - discount;
      impliedReason = 'сильное дро';
    }
  }
  const effectiveRequiredEquityPct = requiredEquityPct * impliedFactor;

  const explanation = buildExplanation({
    eq,
    equityLow,
    equityHigh,
    hasPotOdds,
    potSize,
    toCall,
    requiredEquityPct,
    effectiveRequiredEquityPct,
    outs,
    improveChance,
    impliedFactor,
    impliedReason,
    isMarginal,
    boardLength: board.length,
  });

  if (isNuts || strength.rank >= HandRank.FullHouse) {
    return adviceResult(
      'raise',
      computeAdviceReliability({ action: 'raise', hasPotOdds, isMarginal, tier: 'nuts' }),
      isNuts ? M.reason.nuts : M.reason.strongHand,
      explanation,
    );
  }

  if (phase === 'preflop' && isPremiumPocketPair(holeCards)) {
    return adviceResult(
      'raise',
      computeAdviceReliability({ action: 'raise', hasPotOdds, isMarginal, tier: 'premium' }),
      toCall > 0 ? M.reason.premiumVsBet : M.reason.premium,
      explanation,
    );
  }

  if (strength.rank >= HandRank.TwoPair) {
    return adviceResult(
      toCall > 0 ? 'call' : 'raise',
      computeAdviceReliability({
        action: toCall > 0 ? 'call' : 'raise',
        hasPotOdds,
        isMarginal,
        tier: 'strong',
      }),
      M.reason.strongReady,
      explanation,
      toCall > 0 ? M.details.raiseOrCall : undefined,
    );
  }

  if (outs >= 8 && hasPotOdds && improveChance >= requiredEquity) {
    const drawGapPp = improveChance * 100 - effectiveRequiredEquityPct;
    return adviceResult(
      'call',
      computeAdviceReliability({
        action: 'call',
        gapPp: drawGapPp,
        hasPotOdds,
        isMarginal,
        tier: 'default',
      }),
      fmt(M.reason.strongDraw, { outs }),
      explanation,
      M.details.drawOddsOk,
      requiredEquityPct < 25 ? M.details.potLargeVsBet : undefined,
    );
  }

  const foldBarPct = toCall > 0
    ? Math.max(effectiveRequiredEquityPct * FOLD_EQUITY_MULTIPLIER, latePos ? FOLD_BAR_LATE_PCT : FOLD_BAR_EARLY_PCT) * pfrModifier
    : 100;
  const isPreflopNeverFold = phase === 'preflop' && isPreflopNeverFoldWeak(holeCards);
  const isPreflopSetMine = phase === 'preflop' && isPocketPair(holeCards) && !isPremiumPocketPair(holeCards);
  if (
    !isPreflopNeverFold &&
    !isPreflopSetMine &&
    strength.rank <= HandRank.Pair &&
    outs < 5 &&
    toCall > 0 &&
    eq < foldBarPct
  ) {
    const weakHandReason = board.length >= 5 ? M.reason.weakRiver : M.reason.weakFewOuts;
    return adviceResult(
      'fold',
      computeAdviceReliability({
        action: 'fold',
        gapPp: foldBarPct - eq,
        hasPotOdds,
        isMarginal,
        tier: 'default',
      }),
      weakHandReason,
      explanation,
      requiredEquityPct > 40 ? M.details.betLargeVsPot : undefined,
      oppDetail,
    );
  }

  const lowEqFoldMargin = latePos ? LOW_EQ_FOLD_MARGIN_LATE : LOW_EQ_FOLD_MARGIN_EARLY;
  if (
    !isPreflopNeverFold &&
    !isPreflopSetMine &&
    toCall > 0 &&
    eq < effectiveRequiredEquityPct * lowEqFoldMargin
  ) {
    return adviceResult(
      'fold',
      computeAdviceReliability({
        action: 'fold',
        gapPp: effectiveRequiredEquityPct - eq,
        hasPotOdds,
        isMarginal,
        tier: 'default',
      }),
      M.reason.equityBelowRequired,
      explanation,
      M.details.callNotWorthwhile,
      oppDetail,
    );
  }

  if (toCall === 0) {
    return adviceResult(
      'check',
      computeAdviceReliability({ action: 'check', hasPotOdds, isMarginal, tier: 'default' }),
      M.reason.noBetCheck,
      explanation,
    );
  }

  if (!hasPotOdds) {
    const minEqForCall = latePos ? MIN_EQ_NO_POTODDS_LATE_PCT : MIN_EQ_NO_POTODDS_EARLY_PCT;
    const noOddsReason = potSize > 0 && toCall === 0
      ? M.details.noBetNoOdds
      : M.details.noPotNoOdds;
    if (eq >= STRONG_EQ_NO_POTODDS_PCT) {
      return adviceResult(
        'call',
        computeAdviceReliability({
          action: 'call',
          hasPotOdds: false,
          isMarginal,
          tier: 'default',
          eq,
          latePos,
        }),
        M.reason.callByStrength,
        explanation,
        noOddsReason,
      );
    }
    const noOddsAction = eq >= minEqForCall ? 'call' : 'fold';
    return adviceResult(
      noOddsAction,
      computeAdviceReliability({
        action: noOddsAction,
        hasPotOdds: false,
        isMarginal,
        tier: 'default',
        eq,
        latePos,
      }),
      eq >= minEqForCall ? M.reason.equityEnough : M.reason.equityNotEnoughFold,
      explanation,
      noOddsReason,
    );
  }

  const margin = eq - effectiveRequiredEquityPct;
  if (margin >= CALL_MARGIN_STRONG_PCT) {
    return adviceResult(
      'call',
      computeAdviceReliability({
        action: 'call',
        gapPp: margin,
        hasPotOdds,
        isMarginal,
        tier: 'default',
      }),
      M.reason.callProfitable,
      explanation,
      requiredEquityPct < 20 ? M.details.potGoodOdds : undefined,
    );
  }
  if (margin >= CALL_MARGIN_OK_PCT) {
    return adviceResult(
      'call',
      computeAdviceReliability({
        action: 'call',
        gapPp: margin,
        hasPotOdds,
        isMarginal,
        tier: 'default',
      }),
      M.reason.callOk,
      explanation,
    );
  }

  const baseCallThreshold = latePos ? CALL_THRESHOLD_LATE_PCT : CALL_THRESHOLD_EARLY_PCT;
  const callThreshold = baseCallThreshold * pfrModifier;
  const borderlineAction = margin >= callThreshold ? 'call' : 'fold';
  const borderlineGapPp =
    borderlineAction === 'call' ? margin - callThreshold : callThreshold - margin;
  return adviceResult(
    borderlineAction,
    computeAdviceReliability({
      action: borderlineAction,
      gapPp: borderlineGapPp,
      hasPotOdds,
      isMarginal,
      tier: 'default',
    }),
    margin >= callThreshold ? M.reason.callBorderline : M.reason.equityShort,
    explanation,
    oppDetail,
  );
}
