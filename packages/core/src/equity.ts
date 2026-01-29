import { createDeck, removeKnown, shuffleDeck } from './deck';
import { evaluatePlayerHand, compareHands } from './hand-eval';
import type { Card } from './types';

/** Простой генератор с сидом: одинаковые входы → одинаковый эквити при расчёте */
function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/** Числовой сид из карт и числа оппонентов, чтобы один и тот же ввод давал один результат */
function hashInput(holeCards: Card[], board: Card[], numOpponents: number): number {
  const s = holeCards.join('') + board.join('') + String(numOpponents);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * Эквити (доля выигрыша) через симуляцию Монте-Карло.
 * Наша рука: holeCards + board. Остальные карты раздаются противникам (numOpponents),
 * затем доделывается борд до 5 карт. Считаем доли побед/разделов.
 * Используется фиксированный сид от входных данных — при одинаковых параметрах результат не скачет.
 */
export function equity(
  holeCards: Card[],
  board: Card[],
  numOpponents: number = 1,
  iterations: number = 500
): { win: number; tie: number; lose: number; total: number } {
  if (holeCards.length !== 2) {
    return { win: 0, tie: 0, lose: 1, total: 0 };
  }

  const deck = createDeck();
  const dead = [...holeCards, ...board];
  const seed = hashInput(holeCards, board, numOpponents);
  const random = seededRandom(seed);
  let wins = 0;
  let ties = 0;
  let losses = 0;

  for (let i = 0; i < iterations; i++) {
    let remaining = removeKnown(deck, dead);
    remaining = shuffleDeck(remaining, random);

    const needBoard = 5 - board.length;
    const needOpponents = numOpponents * 2;
    if (remaining.length < needBoard + needOpponents) continue;

    const newBoard = [...board, ...remaining.splice(0, needBoard)];
    const ourHand = evaluatePlayerHand(holeCards, newBoard);

    const opponentHands: ReturnType<typeof evaluatePlayerHand>[] = [];
    for (let o = 0; o < numOpponents; o++) {
      const oppCards = remaining.splice(0, 2);
      opponentHands.push(evaluatePlayerHand(oppCards, newBoard));
    }

    let bestOpp = opponentHands[0];
    for (const h of opponentHands) {
      if (compareHands(h, bestOpp) > 0) bestOpp = h;
    }

    const cmp = compareHands(ourHand, bestOpp);
    if (cmp > 0) wins++;
    else if (cmp === 0) ties++;
    else losses++;
  }

  const total = wins + ties + losses;
  return {
    win: total > 0 ? wins / total : 0,
    tie: total > 0 ? ties / total : 0,
    lose: total > 0 ? losses / total : 0,
    total,
  };
}

/** Эквити в процентах (win%) для отображения */
export function equityPercent(
  holeCards: Card[],
  board: Card[],
  numOpponents: number = 1,
  iterations: number = 500
): number {
  const e = equity(holeCards, board, numOpponents, iterations);
  return Math.round((e.win + e.tie / 2) * 100);
}

/** Эквити в процентах и диапазон (нижняя — верхняя граница, ~95% доверительный интервал) */
export function equityPercentRange(
  holeCards: Card[],
  board: Card[],
  numOpponents: number = 1,
  iterations: number = 500
): { percent: number; low: number; high: number } {
  const e = equity(holeCards, board, numOpponents, iterations);
  const total = e.total;
  const p = e.win + e.tie / 2;
  const percent = Math.round(p * 100);
  if (total <= 0) return { percent: 0, low: 0, high: 0 };
  const se = Math.sqrt((p * (1 - p)) / total);
  const z = 1.96;
  const low = Math.max(0, Math.round((p - z * se) * 100));
  const high = Math.min(100, Math.round((p + z * se) * 100));
  return { percent, low, high };
}
