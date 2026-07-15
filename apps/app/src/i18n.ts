/**
 * Словарь UI-текстовок приложения (метки, объяснения, подписи блока «Почему так?»).
 *
 * ЭТОТ ФАЙЛ — единственное место для правки UI-формулировок.
 * app.ts логику не трогайте; ключи фиксированы типом UiMessages.
 *
 * Тексты совета (reason/details) живут отдельно в @poker/core → messages(),
 * т.к. тестируются вместе с логикой.
 *
 * Переключение локали в runtime — через setUiLocale('ru' | 'en').
 * app.ts обращается к словарю через геттер U = ui(), поэтому меняется автоматически.
 *
 * Плейсхолдеры в {фигурных скобках} подставляются функцией fmt() из @poker/core.
 */

import { fmt, type Locale } from '@poker/core';

/** Названия действий для UI. */
export interface ActionLabels {
  fold: string;
  check: string;
  call: string;
  raise: string;
  'all-in': string;
}

/** Оценка надёжности совета — 3 градации. */
export interface ReliabilityMessages {
  borderline: string;
  confident: string;
  moderate: string;
}

/** Тексты-объяснения в блоке «Почему так?». Плейсхолдеры подставляются через fmt(). */
export interface ExplanationMessages {
  priceNote: string;
  thresholdNote: string;
  /** Дополнение к thresholdNote при активных имплайд-оддсах (лидирующий пробел намеренный). */
  thresholdImpliedNote: string;
  equityNote: string;
  /** Дополнение к equityNote при диапазоне эквити (лидирующий пробел намеренный). */
  equityRangeNote: string;
  gapPositiveNote: string;
  gapNegativeNote: string;
  outsNote: string;
  /** Дополнение к outsNote при известном шансе улучшения (лидирующий пробел намеренный). */
  outsImprove: string;
  impliedNote: string;
  thresholdUnavailable: string;
  thresholdUnavailableNote: string;
}

/** Метки строк объяснения. */
export interface ExplanationLabels {
  price: string;
  threshold: string;
  equity: string;
  gap: string;
  decision: string;
  outs: string;
  impliedOdds: string;
}

/** Метки индикатора надёжности. */
export interface ConfidenceLabels {
  title: string;
  titleShort: string;
  tooltip: string;
}

export interface UiMessages {
  actions: ActionLabels;
  reliability: ReliabilityMessages;
  explanation: ExplanationMessages;
  labels: ExplanationLabels;
  confidence: ConfidenceLabels;
}

// ──────────────────────────────────────────────────────────────────────────
// Локали
// ──────────────────────────────────────────────────────────────────────────

const ruUiMessages: UiMessages = {
  actions: {
    fold: 'фолд',
    check: 'чек',
    call: 'колл',
    raise: 'рейз',
    'all-in': 'олл-ин',
  },
  reliability: {
    borderline: 'Решение на грани — малейшее изменение банка, ставки или карт меняет совет.',
    confident: 'Совет однозначен: запас или дефицит эквити существенный.',
    moderate: 'Совет умеренно надёжен — запас есть, но небольшой.',
  },
  explanation: {
    priceNote: 'Платите {call}, чтобы побороться за банк {potAfter}.',
    thresholdNote: 'Порог: колл ÷ (банк + колл) = {call} ÷ ({pot} + {call}) ≈ {pct}%.',
    thresholdImpliedNote: ' С учётом имплайд-оддсов порог снижен до {eff}%.',
    equityNote: 'Шанс выиграть банк при ваших картах и числе соперников.',
    equityRangeNote: ' Диапазон — разброс симуляции.',
    gapPositiveNote: 'Что есть − сколько нужно: {eq}% − {thr}% = {gap} п.п. Положительный запас — колл окупается.',
    gapNegativeNote: 'Что есть − сколько нужно: {eq}% − {thr}% = {gap} п.п. Эквити ниже порога — колл не окупается.',
    outsNote: 'Карты, усиливающие руку на терне или ривере.',
    outsImprove: ' Примерно {pct}% усилиться на следующей улице.',
    impliedNote: 'При усилении можно выиграть больше текущего банка — порог колла ниже.',
    thresholdUnavailable: 'недоступен',
    thresholdUnavailableNote: 'Укажите банк — без него не рассчитать, окупается ли колл.',
  },
  labels: {
    price: 'Цена',
    threshold: 'Порог',
    equity: 'Эквити',
    gap: 'Разница',
    decision: 'Решение',
    outs: 'Ауты',
    impliedOdds: 'Имплайд-оддсы',
  },
  confidence: {
    title: 'надёжность по данным',
    titleShort: 'надёжн.',
    tooltip: 'Надёжность совета по текущим данным — насколько он однозначен при ваших картах, банке и ставке. Не шанс выиграть.',
  },
};

const enUiMessages: UiMessages = {
  actions: {
    fold: 'fold',
    check: 'check',
    call: 'call',
    raise: 'raise',
    'all-in': 'all-in',
  },
  reliability: {
    borderline: 'Marginal — a small change in pot, bet, or cards flips the advice.',
    confident: 'Clear call: the equity gap is significant either way.',
    moderate: 'Reasonably confident — there is a margin, but a modest one.',
  },
  explanation: {
    priceNote: 'You pay {call} to contest a pot of {potAfter}.',
    thresholdNote: 'Threshold: call ÷ (pot + call) = {call} ÷ ({pot} + {call}) ≈ {pct}%.',
    thresholdImpliedNote: ' With implied odds the threshold drops to {eff}%.',
    equityNote: 'Chance to win the pot with your cards against the field.',
    equityRangeNote: ' Range = simulation spread.',
    gapPositiveNote: 'Have − need: {eq}% − {thr}% = {gap} pp. Positive margin — the call pays off.',
    gapNegativeNote: 'Have − need: {eq}% − {thr}% = {gap} pp. Equity below threshold — the call does not pay off.',
    outsNote: 'Cards that improve your hand on the turn or river.',
    outsImprove: ' About {pct}% chance to improve on the next street.',
    impliedNote: 'If you improve, you can win more than the current pot — so the call threshold is lower.',
    thresholdUnavailable: 'unavailable',
    thresholdUnavailableNote: 'Enter the pot size — without it the call cannot be evaluated.',
  },
  labels: {
    price: 'Cost',
    threshold: 'Threshold',
    equity: 'Equity',
    gap: 'Gap',
    decision: 'Decision',
    outs: 'Outs',
    impliedOdds: 'Implied odds',
  },
  confidence: {
    title: 'data confidence',
    titleShort: 'conf.',
    tooltip: 'How definitive the advice is given your cards, pot, and bet. Not your chance to win.',
  },
};

const UI_LOCALES: Record<Locale, UiMessages> = {
  ru: ruUiMessages,
  en: enUiMessages,
};

let currentUiLocale: Locale = 'ru';

/**
 * Текущий словарь UI.
 * Геттер, а не константа, чтобы setUiLocale() работал в runtime.
 */
export function ui(): UiMessages {
  return UI_LOCALES[currentUiLocale];
}

/** Активная UI-локаль. */
export function getUiLocale(): Locale {
  return currentUiLocale;
}

/** Переключить UI-локаль. Возвращает true, если локаль поддерживается. */
export function setUiLocale(locale: Locale): boolean {
  if (!(locale in UI_LOCALES)) return false;
  currentUiLocale = locale;
  return true;
}

/** Хелпер-обёртка для подстановки параметров в шаблоны UI. */
export function t(template: string, params?: Record<string, string | number>): string {
  return fmt(template, params);
}
