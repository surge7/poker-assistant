/**
 * Главный оркестратор совета: getAdvice(ctx) → AdviceResult.
 *
 * Декомпозиция:
 * - hand-classifiers.ts: isPocketPair, isPremiumPocketPair, isPreflopNeverFoldWeak
 * - implied-odds.ts: computeImpliedFactor
 * - reliability.ts: computeAdviceReliability
 * - explanation.ts: buildExplanation
 *
 * Этот файл содержит только decision flow (логика выбора fold/call/raise)
 * и обвязку для формирования AdviceResult с i18n-сообщениями.
 *
 * Позиция влияет на пороги решения, но не озвучивается в тексте совета.
 * Формулировки (reason/details) хранятся в i18n/ (ru.ts, en.ts).
 * Чтобы поменять текст совета, правьте словарь, а не эту функцию.
 * Локаль переключается через setLocale('ru' | 'en').
 */

import { equityPercent } from '../equity/equity';
import { evaluatePlayerHand } from '../eval/hand-eval';
import { totalOuts } from '../equity/outs';
import { compareToNuts } from '../eval/nuts';
import { isLatePosition } from './positions';
import type { TableContext, AdviceResult, AdviceExplanation } from '../types';
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
  PFR_BASE,
  PFR_MODIFIER_SENSITIVITY,
  PFR_MODIFIER_MIN,
  PFR_MODIFIER_MAX,
} from '../config/thresholds';
import { DEFAULT_ITERATIONS } from '../config/simulation';
import { messages, fmt } from '../i18n';
import { computeImpliedFactor } from './implied-odds';
import { isPocketPair, isPremiumPocketPair, isPreflopNeverFoldWeak } from './hand-classifiers';
import { computeAdviceReliability } from './reliability';
import { buildExplanation } from './explanation';

/** Ограничить PFR-модификатор. */
function clampPfr(v: number): number {
  return Math.max(PFR_MODIFIER_MIN, Math.min(PFR_MODIFIER_MAX, v));
}

/** Сконструировать AdviceResult: action + confidence + reason + explanation + опциональные details. */
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

// Импорт AdviceExplanation выше — он нужен только в adviceResult.

/**
 * Простые советы на основе силы руки, эквити, аутов и позиции.
 * Позиция влияет на пороги решения, но не озвучивается в тексте совета.
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

  const { factor: impliedFactor, reason: impliedReason } = computeImpliedFactor(
    phase, holeCards, board, outs, latePos,
  );
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
