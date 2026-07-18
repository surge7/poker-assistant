/**
 * Рендеринг блока результатов: совет, эквити, ауты, натс, сила руки.
 *
 * Все функции возвращают HTML-строки (а не мутируют DOM) — это позволяет
 * собирать финальный HTML инкрементально и легко тестировать.
 */

import type { AdviceExplanation, AdviceResult, Card, HandStrength, OutsResult } from '@poker/core';
import { cardToHtml } from './cards';
import { ui, t } from './i18n';
import {
  actionClass,
  actionLabel,
  equityClass,
  explanationRow,
  formatExplanationPct,
  formatGapPp,
  decisionReliabilityNote,
} from './format';

export interface EquityRange {
  percent: number;
  low: number;
  high: number;
}

export interface RenderContext {
  advice: AdviceResult;
  eqRange: EquityRange;
  potSize: number;
  toCall: number;
  boardLength: number;
  numPlayers: number;
  handLabel: string;
  strength: HandStrength;
  outsList: OutsResult[];
  totalOutsCount: number;
  nutsDescription: string | null;
  isNuts: boolean;
}

/** Пустое состояние: нет двух карт в руке. */
export function renderEmptyState(): string {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="6" width="14" height="20" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
          <rect x="26" y="6" width="14" height="20" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M24 32 L24 42 M18 42 L30 42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="empty-state-title">Начнём раздачу</div>
      <div class="empty-state-subtitle">Выберите две карты — и я подскажу что делать</div>
    </div>
  `;
}

/** Состояние ошибки: дубликаты карт. */
export function renderErrorState(message: string): string {
  return `
    <div class="error-state">
      <div class="error-state-icon">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="13" stroke="currentColor" stroke-width="2"/>
          <path d="M16 9v8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="16" cy="22" r="1.5" fill="currentColor"/>
        </svg>
      </div>
      <div class="error-state-title">Ой, дубликат</div>
      <div class="error-state-subtitle">${message}</div>
    </div>
  `;
}

/** Hero: action + confidence + equity + reason + details. */
function renderHero(
  advice: AdviceResult,
  eqRange: EquityRange,
  boardLength: number,
): string {
  const U = ui();
  const reliabilityPct = Math.round(advice.confidence * 100);
  const heroActionClass = actionClass(advice.action);

  let equityRow = '';
  if (boardLength >= 3) {
    const eqCls = equityClass(eqRange.percent);
    equityRow = `
      <div class="results-equity-row">
        <span class="results-equity-label">Эквити</span>
        <span class="${eqCls}">${eqRange.low}%–${eqRange.high}%</span>
      </div>
    `;
  }

  return `
    <div class="results-hero animate-fade-in-up">
      <div class="results-hero-top">
        <div class="${heroActionClass}">${advice.action.toUpperCase()}</div>
        <div class="results-confidence" title="${U.confidence.tooltip}">
          <span class="results-confidence-label results-confidence-label--full">${U.confidence.title}</span>
          <span class="results-confidence-label results-confidence-label--short" aria-hidden="true">${U.confidence.titleShort}</span>
          ${reliabilityPct}%
        </div>
      </div>
      ${equityRow}
      <p class="results-reason">${advice.reason}</p>
      ${advice.details?.length ? `
        <ul class="results-facts">
          ${advice.details.map((d) => `<li>${d}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
}

/** Сила руки (название + 5 карт). */
function renderHandStrength(label: string, strength: HandStrength): string {
  return `
    <div class="results-hand">
      <span class="results-hand-name">${label}</span>
      <span class="results-hand-cards">${strength.cards.map((c: Card) => cardToHtml(c)).join('')}</span>
    </div>
  `;
}

/** Ауты: details с раскрытием. */
function renderOutsDetails(outsList: OutsResult[], totalOutsCount: number, boardLength: number): string {
  if (boardLength < 3 || boardLength >= 5) return '';
  return `
    <details class="results-details">
      <summary>Ауты${totalOutsCount > 0 ? ` (${totalOutsCount})` : ''}</summary>
      <div class="results-details-body">
        ${outsList.length ? outsList.map((o) => {
          const cardsHtml = o.outCards?.length ? `<div class="outs-cards">${o.outCards.map((c) => cardToHtml(c)).join('')}</div>` : '';
          return `<div class="outs-item"><p>${o.description} — шанс ${(o.improveChance * 100).toFixed(1)}%</p>${cardsHtml}</div>`;
        }).join('') : '<p>Нет явных дро.</p>'}
      </div>
    </details>
  `;
}

/** Equity details: диапазон + пояснение про семантику (доля банка vs вероятность). */
function renderEquityDetails(eqRange: EquityRange, numPlayers: number, boardLength: number): string {
  if (boardLength < 3) return '';
  return `
    <details class="results-details">
      <summary>Эквити</summary>
      <div class="results-details-body">
        <p>${eqRange.low}%–${eqRange.high}% — шанс лучшей руки против ${numPlayers - 1} оппонентов (~${eqRange.percent}% в среднем).</p>
        <p class="results-hint">Семантика: вероятность, что к концу раздачи ваша рука сильнее всех оппонентов, а не доля банка.</p>
      </div>
    </details>
  `;
}

/** Натс. */
function renderNutsDetails(description: string, isNuts: boolean): string {
  return `
    <details class="results-details">
      <summary>Натс</summary>
      <div class="results-details-body">
        <p>${description}</p>
        ${isNuts ? '<p class="nuts-badge">🏆 У вас натс!</p>' : ''}
      </div>
    </details>
  `;
}

/** Блок «Почему так?» — структурированное объяснение. */
export function renderAdviceExplanation(
  explanation: AdviceExplanation | undefined,
  action: string,
  confidence: number,
  potSize: number,
  toCall: number,
  boardLength: number,
): string {
  if (!explanation) return '';

  const U = ui();
  const rows: string[] = [];
  const callAmount = explanation.toCall ?? toCall;
  const potAmount = explanation.potSize ?? potSize;
  const hasPotOdds = callAmount > 0 && potAmount > 0 && explanation.requiredPct != null;
  const effective = explanation.effectiveRequiredPct ?? explanation.requiredPct;
  const hasImplied =
    explanation.impliedOdds != null &&
    explanation.impliedOdds < 1 &&
    explanation.effectiveRequiredPct != null &&
    explanation.effectiveRequiredPct !== explanation.requiredPct;

  if (callAmount > 0 && potAmount > 0) {
    const potAfterCall = potAmount + callAmount;
    rows.push(
      explanationRow(
        U.labels.price,
        `${callAmount} → ${potAfterCall}`,
        t(U.explanation.priceNote, { call: callAmount, potAfter: potAfterCall }),
      ),
    );
  }

  if (hasPotOdds && explanation.requiredPct != null && effective != null) {
    const basePctStr = formatExplanationPct(explanation.requiredPct);
    const effectivePctStr = formatExplanationPct(effective);
    const thresholdValue = hasImplied
      ? `${effectivePctStr}% <span class="explanation-muted">(было ${basePctStr}%)</span>`
      : `${basePctStr}%`;
    let thresholdNote = t(U.explanation.thresholdNote, {
      call: callAmount,
      pot: potAmount,
      pct: basePctStr,
    });
    if (hasImplied) {
      thresholdNote += t(U.explanation.thresholdImpliedNote, { eff: effectivePctStr });
    }
    rows.push(explanationRow(U.labels.threshold, thresholdValue, thresholdNote));
  } else if (explanation.potOddsUnavailable) {
    rows.push(
      explanationRow(
        U.labels.threshold,
        U.explanation.thresholdUnavailable,
        U.explanation.thresholdUnavailableNote,
      ),
    );
  }

  let equityValue = `${explanation.equityPct}%`;
  const hasEquityRange =
    explanation.equityLow != null && explanation.equityHigh != null;
  if (hasEquityRange) {
    equityValue = `${explanation.equityLow}%–${explanation.equityHigh}%`;
  }
  let equityNote = U.explanation.equityNote;
  if (hasEquityRange) {
    equityNote += U.explanation.equityRangeNote;
  }
  rows.push(explanationRow(U.labels.equity, equityValue, equityNote));

  if (hasPotOdds && explanation.marginPct != null && effective != null) {
    const equityStr = formatExplanationPct(explanation.equityPct);
    const thresholdStr = formatExplanationPct(effective);
    const gapStr = formatGapPp(explanation.marginPct);
    const gapNote = explanation.marginPct >= 0
      ? t(U.explanation.gapPositiveNote, { eq: equityStr, thr: thresholdStr, gap: gapStr })
      : t(U.explanation.gapNegativeNote, { eq: equityStr, thr: thresholdStr, gap: gapStr });
    rows.push(explanationRow(U.labels.gap, `${gapStr} п.п.`, gapNote));
  }

  const decisionNote = decisionReliabilityNote(confidence, explanation.marginPct, explanation.isMarginal);
  rows.push(
    explanationRow(
      U.labels.decision,
      actionLabel(action),
      decisionNote,
    ),
  );

  if (boardLength >= 3 && boardLength < 5 && explanation.outs != null && explanation.outs > 0) {
    const improve =
      explanation.improveChancePct != null
        ? t(U.explanation.outsImprove, { pct: explanation.improveChancePct })
        : '';
    rows.push(
      explanationRow(
        U.labels.outs,
        String(explanation.outs),
        `${U.explanation.outsNote}${improve}`,
      ),
    );
  }

  if (explanation.impliedOdds != null && explanation.impliedOdds < 1 && explanation.impliedReason) {
    rows.push(
      explanationRow(
        U.labels.impliedOdds,
        explanation.impliedReason,
        U.explanation.impliedNote,
      ),
    );
  }

  if (rows.length === 0) return '';

  return `
    <details class="results-details results-explanation">
      <summary>Почему так?</summary>
      <div class="results-details-body explanation-body">
        ${rows.join('')}
      </div>
    </details>
  `;
}

/** Собрать весь блок результата в одну HTML-строку. */
export function renderResults(ctx: RenderContext): string {
  const hero = renderHero(ctx.advice, ctx.eqRange, ctx.boardLength);
  const explanation = renderAdviceExplanation(
    ctx.advice.explanation,
    ctx.advice.action,
    ctx.advice.confidence,
    ctx.potSize,
    ctx.toCall,
    ctx.boardLength,
  );
  const hand = renderHandStrength(ctx.handLabel, ctx.strength);
  const outs = renderOutsDetails(ctx.outsList, ctx.totalOutsCount, ctx.boardLength);
  const equity = renderEquityDetails(ctx.eqRange, ctx.numPlayers, ctx.boardLength);
  const nuts = ctx.nutsDescription ? renderNutsDetails(ctx.nutsDescription, ctx.isNuts) : '';

  return [hero, explanation, hand, outs, equity, nuts].filter(Boolean).join('');
}
