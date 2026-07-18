/**
 * Форматтеры и шаблоны для UI. Чистые функции — без побочных эффектов.
 *
 * Используются в:
 * - render.ts (рендеринг explanation)
 * - app.ts (рендеринг advice)
 */

import { ui, type ActionLabels } from './i18n';

/** HTML-шаблон одной строки в блоке «Почему так?». */
export function explanationRow(label: string, value: string, note?: string): string {
  return `<div class="explanation-row">
    <span class="explanation-label">${label}</span>
    <span class="explanation-value">${value}</span>
    ${note ? `<span class="explanation-note">${note}</span>` : ''}
  </div>`;
}

/** Целое — без дроби, иначе одна цифра после запятой. */
export function formatExplanationPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Форматировать gap (разницу) со знаком: +12.5 или −5. */
export function formatGapPp(gap: number): string {
  const formatted = formatExplanationPct(Math.abs(gap));
  return gap >= 0 ? `+${formatted}` : `−${formatted}`;
}

/**
 * Текстовая оценка надёжности совета:
 * - borderline: низкая confidence или маленький gap, или маргинальное решение
 * - moderate: средняя
 * - confident: высокая confidence и большой gap
 */
export function decisionReliabilityNote(
  confidence: number,
  marginPct: number | undefined,
  isMarginal?: boolean,
): string {
  const U = ui();
  const absGap = marginPct != null ? Math.abs(marginPct) : 0;
  if (isMarginal || absGap < 8 || confidence < 0.55) {
    return U.reliability.borderline;
  }
  if (confidence >= 0.72 || absGap >= 18) {
    return U.reliability.confident;
  }
  return U.reliability.moderate;
}

/** Получить CSS-класс для action: fold, check, прочее. */
export function actionClass(action: string): string {
  if (action === 'fold') return 'results-action results-action--fold';
  if (action === 'check') return 'results-action results-action--neutral';
  return 'results-action results-action--positive';
}

/** Получить CSS-класс для equity (low equity → отдельный класс). */
export function equityClass(percent: number): string {
  return percent < 35 ? 'results-equity results-equity--low' : 'results-equity';
}

/** Подпись действия на нужном языке. */
export function actionLabel(action: string): string {
  const U = ui();
  return U.actions[action as keyof ActionLabels] ?? action;
}
