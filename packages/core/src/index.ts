/**
 * @poker/core — ядро покерного помощника.
 * Офлайн, без зависимостей от DOM/React. Используется в Web и в Capacitor (Android/iOS).
 */

// Типы
export type {
  Card,
  Rank,
  Suit,
  GamePhase,
  HandStrength,
  TableContext,
  OutsResult,
  AdviceResult,
  PositionIndex,
} from './types';
export { RANKS, SUITS, HandRank, POSITION_NAMES } from './types';

// Колода
export {
  createDeck,
  shuffleDeck,
  removeKnown,
  isValidCard,
  formatCard,
} from './deck';

// Оценка руки
export {
  evaluateHand,
  evaluatePlayerHand,
  compareHands,
} from './hand-eval';

// Ауты и шансы
export { countOuts, totalOuts } from './outs';

// Эквити
export { equity, equityPercent, equityPercentRange } from './equity';

// Натс
export { getNuts, compareToNuts } from './nuts';

// Советы
export { getAdvice } from './advice';
