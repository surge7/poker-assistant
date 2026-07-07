/**
 * Базовые типы покерного ядра.
 * Карты: строка "As" (туз пики), "Kh" (король черви), "7d", "2c".
 */

import type { Opponent } from './players/profiles';

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['s', 'h', 'd', 'c'] as const; // spades, hearts, diamonds, clubs

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

/** Карта в формате "As", "Kh", "7d", "2c" */
export type Card = string;

/** Сила комбинации (чем больше — тем сильнее) */
export enum HandRank {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export type GamePhase = 'preflop' | 'flop' | 'turn' | 'river';

/** Результат оценки руки: сила + описание для UI */
export interface HandStrength {
  rank: HandRank;
  name: string;
  /** Карты, входящие в комбинацию (для отображения) */
  cards: Card[];
  /** Числовое значение для сравнения (старшие карты и т.д.) */
  value: number;
}

/** Позиция за столом: 0 = BTN, 1 = SB, 2 = BB, 3 = UTG, 4 = MP, 5 = CO (по часовой от дилера) */
export type PositionIndex = number;

/** Названия позиций для UI */
export const POSITION_NAMES: Record<number, string> = {
  0: 'BTN',
  1: 'SB',
  2: 'BB',
  3: 'UTG',
  4: 'MP',
  5: 'CO',
};

/** Контекст стола для советов */
export interface TableContext {
  phase: GamePhase;
  board: Card[];
  holeCards: Card[];
  potSize: number;
  toCall: number;
  numPlayers: number;
  positionIndex: PositionIndex; // 0 = BTN, 1 = SB, 2 = BB, 3 = UTG, 4 = MP, 5 = CO
  /** Если задано — используется вместо внутреннего расчёта эквити (ускоряет, когда эквити уже посчитан в UI). */
  equityPercent?: number;
  /** Нижняя граница 95% CI эквити (для детекции маргинальных решений). Если задано вместе с equityHigh. */
  equityLow?: number;
  /** Верхняя граница 95% CI эквити. */
  equityHigh?: number;
  /** Оппоненты с их метриками для будущей фичи профилей. Не используется в v1.3. */
  opponents?: Opponent[];
  /** Индекс активного оппонента (ставщика) в opponents[]. Используется для PFR-модификатора. */
  activeOpponentIndex?: number;
}

/** Результат расчёта аутов */
export interface OutsResult {
  outs: number;
  description: string;
  /** Приближённая вероятность улучшения на следующей улице (0..1) */
  improveChance: number;
  /** Карты, которые являются аутами (для отображения) */
  outCards?: Card[];
}

/** Результат совета */
export interface AdviceResult {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  confidence: number; // 0..1
  reason: string;
}
