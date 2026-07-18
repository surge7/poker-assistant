/**
 * Типы сообщений советов.
 *
 * Все текстовки совета (кроме UI-специфичных) описаны здесь как типизированный словарь.
 * Конкретные переводы живут отдельно (см. ru.ts). Менять формулировки можно правкой
 * словаря — без касания логики advice.ts.
 *
 * Шаблоны могут содержать плейсхолдеры {name}, которые подставляются функцией fmt().
 */

/** Главная мысль совета — одна строка, выводится крупно под действием. */
export interface AdviceReasonMessages {
  /** Натс. */
  nuts: string;
  /** Фулл-хаус или сильнее (не натс). */
  strongHand: string;
  /** Премиум-пара (AA–JJ) против ставки оппонента. */
  premiumVsBet: string;
  /** Премиум-пара (AA–JJ) без ставки. */
  premium: string;
  /** Две пары или сильнее — готовая рука. */
  strongReady: string;
  /** Сильное дро (≥8 аутов). Плейсхолдер: {outs}. */
  strongDraw: string;
  /** Колл оправдан силой руки (без пот-оддсов, но эквити высокое). */
  callByStrength: string;
  /** Эквити достаточно для колла (без пот-оддсов). */
  equityEnough: string;
  /** Колл выгоден по пот-оддсам (запас заметный). */
  callProfitable: string;
  /** Колл допустим (небольшой запас). */
  callOk: string;
  /** Колл на грани порога, но допустим. */
  callBorderline: string;
  /** Слабая рука на ривере. */
  weakRiver: string;
  /** Слабая рука и мало аутов (не ривер). */
  weakFewOuts: string;
  /** Эквити ниже требуемой для колла. */
  equityBelowRequired: string;
  /** Эквити недостаточно — фолд (без пот-оддсов). */
  equityNotEnoughFold: string;
  /** Эквити чуть не дотягивает до колла (borderline). */
  equityShort: string;
  /** Не введены две карты. */
  needTwoCards: string;
  /** Нет ставки на колл — чек. */
  noBetCheck: string;
}

/** Уточнения — массив строк, присоединяются к причине как буллеты. */
export interface AdviceDetailsMessages {
  /** Сильная готовная рука, есть ставка — выбор рейз/колл по действию. */
  raiseOrCall: string;
  /** Дро: шанс улучшения оправдывает колл. */
  drawOddsOk: string;
  /** Дро: банк большой относительно ставки. */
  potLargeVsBet: string;
  /** Фолд: ставка велика относительно банка. */
  betLargeVsPot: string;
  /** Фолд: при таком банк/ставка колл не окупается. */
  callNotWorthwhile: string;
  /** Колл: банк даёт хорошие оддсы. */
  potGoodOdds: string;
  /** Оппонент тайтовый. Плейсхолдер: {activePfr}. */
  oppTight: string;
  /** Оппонент агрессивный. Плейсхолдер: {activePfr}. */
  oppAggressive: string;
  /** Нет ставки на колл — пот-оддсы не применимы. */
  noBetNoOdds: string;
  /** Банк не указан — пот-оддсы недоступны. */
  noPotNoOdds: string;
}

/** Полный словарь сообщений совета. */
export interface AdviceMessages {
  reason: AdviceReasonMessages;
  details: AdviceDetailsMessages;
}
