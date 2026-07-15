/**
 * Построение AdviceExplanation — структурированного объяснения совета для UI.
 *
 * UI читает explanation как data, а не парсит текст reason. Это позволяет
 * рендерить одни и те же поля разными шаблонами (RU/EN) и подсвечивать
 * нужные цифры (эквити, порог, маржа, ауты).
 */

import type { AdviceExplanation } from '../types';

/** Параметры для построения объяснения. Все поля обязательны, кроме equityLow/High. */
export interface ExplanationParams {
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
}

/** Собрать AdviceExplanation с округлением, мутируя стартовый объект. */
export function buildExplanation(params: ExplanationParams): AdviceExplanation {
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
