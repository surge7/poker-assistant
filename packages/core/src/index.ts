/**
 * @poker/core — ядро покерного помощника.
 * Офлайн, без зависимостей от DOM/React. Используется в Web и в Capacitor (Android/iOS).
 *
 * Слои (зависимости только вниз): config → players → eval → equity → strategy.
 * Этот файл — фасад; состав экспортов — публичный API.
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

// Колода и оценка рук (eval/)
export { createDeck, shuffleDeck, removeKnown, isValidCard, formatCard } from './eval/deck';
export { evaluateHand, evaluatePlayerHand, compareHands } from './eval/hand-eval';
export { getNuts, compareToNuts } from './eval/nuts';

// Ауты и эквити (equity/)
export { countOuts, totalOuts } from './equity/outs';
export { equity, equityPercent, equityPercentRange } from './equity/equity';

// Стратегия (strategy/)
export { getAdvice } from './strategy/advice';
export {
  clampNumPlayers,
  clampPositionIndex,
  getPositionName,
  getPositionHelpHtml,
  getTablePositions,
  isLatePosition,
} from './strategy/positions';
export type { TablePosition } from './strategy/positions';

// Игроки (players/) — для будущей фичи профилей
export type { PlayerStats, Opponent } from './players/profiles';
export { raiseFactor } from './players/profiles';
export { statsToRange } from './players/ranges';

// Конфиги (config/) — для прямой настройки стратегии и фичи профилей
export {
  FOLD_EQUITY_MULTIPLIER,
  FOLD_BAR_EARLY_PCT,
  FOLD_BAR_LATE_PCT,
  CONFIDENCE,
} from './config/thresholds';
export { PREMIUM_PAIR_MIN_RANK, BROADWAY_MIN_RANK } from './config/preflop';
export {
  DEFAULT_ITERATIONS,
  PREFLOP_ITERATIONS,
  POSTFLOP_ITERATIONS,
  INTERACTIVE_PREFLOP_ITERATIONS,
  INTERACTIVE_POSTFLOP_ITERATIONS,
} from './config/simulation';
export { HAND_RANKINGS, topPercentHands } from './config/hand-rankings';
export { VPIP_RANGE_NODES } from './config/vpip-ranges';
export { PLAYER_PRESETS, getPreset } from './config/player-presets';
export type { PlayerPresetKey, PlayerPreset } from './config/player-presets';
export {
  PFR_BASE,
  PFR_MODIFIER_SENSITIVITY,
  PFR_MODIFIER_MIN,
  PFR_MODIFIER_MAX,
} from './config/thresholds';
