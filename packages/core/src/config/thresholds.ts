/**
 * Пороги и коэффициенты для советов.
 * Все магические числа стратегии — здесь. См. docs/STRATEGY_ALIGNMENT.md.
 */

// Порог фолда: max(requiredEquity * множитель, абсолютный минимум)
export const FOLD_EQUITY_MULTIPLIER = 1.15;
export const FOLD_BAR_EARLY_PCT = 22;
export const FOLD_BAR_LATE_PCT = 14;

// Запас эквити для решения «эквити ниже требуемой → фолд»
export const LOW_EQ_FOLD_MARGIN_EARLY = 1.1;
export const LOW_EQ_FOLD_MARGIN_LATE = 1.05;

// Колл без пот-оддсов (банк не указан)
export const MIN_EQ_NO_POTODDS_EARLY_PCT = 35;
export const MIN_EQ_NO_POTODDS_LATE_PCT = 30;
export const STRONG_EQ_NO_POTODDS_PCT = 50;

// Маржа эквити над требуемой для уверенного колла
export const CALL_MARGIN_STRONG_PCT = 25;
export const CALL_MARGIN_OK_PCT = 10;

// Порог колла на грани (отрицательный = допускаем небольшой минус по эквити)
export const CALL_THRESHOLD_EARLY_PCT = 0;
export const CALL_THRESHOLD_LATE_PCT = -5;

/** Confidence для каждого типа совета. Ключи соответствуют веткам в advice.ts. */
export const CONFIDENCE = {
  nuts: 0.95,
  premiumPreflop: 0.9,
  strongHand: 0.8,
  drawCall: 0.7,
  foldWeakHandEarly: 0.75,
  foldWeakHandLate: 0.7,
  foldLowEquity: 0.7,
  foldLowEquityMarginal: 0.55,
  callNoPotOddsStrong: 0.6,
  callNoPotOddsStrongLate: 0.65,
  callNoPotOddsWeak: 0.5,
  callMarginStrong: 0.7,
  callMarginStrongLate: 0.75,
  callMarginOk: 0.6,
  callMarginOkLate: 0.65,
  borderline: 0.5,
  borderlineMarginal: 0.4,
  check: 0.5,
  invalid: 0,
} as const;

/**
 * Модификатор порога фолда по агрессивности активного оппонента (PFR).
 * Низкий PFR (нит-рейз ~10) → его ставка весомее → фолд шире → множитель > 1.
 * Высокий PFR (маньяк ~45) → он блефует → колл шире → множитель < 1.
 * Базовый PFR (TAG ~18) → множитель = 1 (без изменения).
 *
 * Формула: factor = clamp(1 + (PFR_BASE - opponentPfr) * SENSITIVITY, MIN, MAX)
 */
export const PFR_BASE = 18;
export const PFR_MODIFIER_SENSITIVITY = 0.015;
export const PFR_MODIFIER_MIN = 0.8;
export const PFR_MODIFIER_MAX = 1.3;

/**
 * Коэффициенты имплайд-оддсов: во сколько раз снижаем требуемую эквити
 * для рук с потенциальной выгодой от улучшения.
 * 1.0 = без имплайдов (чистые pot-оддсы).
 *
 * Сет-майнинг (карманные пары 22-TT на префлопе): сет ~11.8%, но выигрыш
 * превышает колл в несколько раз → 0.65 (колл при 65% от требуемой).
 * Сильное дро (аутов ≥ 8 на флопе): реализуется на ривере, добираем → 0.75.
 * Монстр-дро (аутов ≥ 13, флеш+стрит): почти гарантия → 0.65.
 */
export const IMPLIED_PAIR_FACTOR = 0.65;
export const IMPLIED_STRONG_DRAW_FACTOR = 0.75;
export const IMPLIED_MONSTER_DRAW_FACTOR = 0.65;
export const IMPLIED_MONSTER_DRAW_OUTS = 13;
