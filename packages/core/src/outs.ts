import { createDeck, removeKnown } from './deck';
import type { Card } from './types';
import type { OutsResult } from './types';

/** Приближённые шансы улучшения: флоп→терн (1 карта), терн→ривер (1 карта) */
/** Шанс улучшения на двух улицах (флоп → ривер): 1 - (1 - outs/47)(1 - outs/46) */
const IMPROVE_RULE = {
  twoCards: (outs: number) => 1 - (1 - outs / 47) * (1 - outs / 46),
};

/**
 * Подсчёт аутов: сколько карт улучшат руку до флеша, стрита, пары и т.д.
 * Возвращает несколько категорий (флеш-дро, стрит-дро, оверкарты и т.д.).
 */
export function countOuts(holeCards: Card[], board: Card[]): OutsResult[] {
  const results: OutsResult[] = [];
  if (holeCards.length !== 2 || board.length < 3) return results;

  const deck = createDeck();
  const dead = [...holeCards, ...board];
  const remaining = removeKnown(deck, dead);

  // Флеш-дро: нужно ровно 4 одномастных карты (добираем 5-ю за одну улицу = классический flush draw, 9 аутов).
  // 2 или 3 одномастных на флопе — это backdoor-flush (нужно 2 карты за 2 улицы, ~4%), он НЕ считается аутом.
  const flushCards = getFlushOutCards(holeCards, board, remaining);
  if (flushCards.length > 0) {
    const oneCard = board.length === 5 ? flushCards.length / remaining.length : IMPROVE_RULE.twoCards(flushCards.length);
    results.push({
      outs: flushCards.length,
      description: `Флеш-дро (${flushCards.length} аутов)`,
      improveChance: oneCard,
      outCards: flushCards,
    });
  }

  // Стрит-дро (открытый стрит-дро): карты для стрита
  const straightCards = getStraightOutCards(holeCards, board, remaining);
  if (straightCards.length > 0) {
    const oneCard = board.length === 5 ? straightCards.length / remaining.length : IMPROVE_RULE.twoCards(straightCards.length);
    results.push({
      outs: straightCards.length,
      description: `Стрит-дро (${straightCards.length} аутов)`,
      improveChance: oneCard,
      outCards: straightCards,
    });
  }

  // Дро на каре: уже три карты одного ранга (сет), оставшаяся карта этого ранга даёт каре
  const quadsCards = getQuadsOutCards(holeCards, board, remaining);
  if (quadsCards.length > 0) {
    const chance = board.length === 5 ? quadsCards.length / remaining.length : IMPROVE_RULE.twoCards(quadsCards.length);
    results.push({
      outs: quadsCards.length,
      description: `Дро на каре (${quadsCards.length} аут${quadsCards.length === 1 ? '' : quadsCards.length < 5 ? 'а' : 'ов'})`,
      improveChance: chance,
      outCards: quadsCards,
    });
  }

  // Оверкарты: карты выше борда для пары
  const overcardCards = getOvercardOutCards(holeCards, board, remaining);
  if (overcardCards.length > 0) {
    const chance = board.length === 5 ? overcardCards.length / remaining.length : IMPROVE_RULE.twoCards(overcardCards.length);
    results.push({
      outs: overcardCards.length,
      description: `Оверкарты (${overcardCards.length} аутов)`,
      improveChance: chance,
      outCards: overcardCards,
    });
  }

  return results;
}

/**
 * Упрощённо: один результат «всего аутов» и шанс улучшения. На флопе — на две улицы (Rule of 4); на терне — на одну (Rule of 2).
 * Ауты объединяются по множеству карт: если одна карта даёт и флеш, и стрит (например, Th в монстр-дро),
 * она считается один раз, а не дважды — иначе double-counting завышает improveChance.
 */
export function totalOuts(holeCards: Card[], board: Card[]): { total: number; improveChance: number } {
  const list = countOuts(holeCards, board);
  const outCardSet = new Set<Card>();
  for (const r of list) for (const c of r.outCards ?? []) outCardSet.add(c);
  const total = Math.min(outCardSet.size, 46);
  const remaining = 52 - holeCards.length - board.length;
  const improveChance =
    remaining > 0
      ? board.length === 3
        ? IMPROVE_RULE.twoCards(total) // флоп: две карты впереди (Rule of 4)
        : total / remaining // терн или меньше: одна карта впереде (Rule of 2)
      : 0;
  return { total, improveChance };
}

function getFlushOutCards(holeCards: Card[], board: Card[], remaining: Card[]): Card[] {
  const suitCount: Record<string, number> = { s: 0, h: 0, d: 0, c: 0 };
  for (const c of [...holeCards, ...board]) {
    suitCount[c[1]] = (suitCount[c[1]] ?? 0) + 1;
  }
  for (const [s, count] of Object.entries(suitCount)) {
    const inHole = holeCards.some((c) => c[1] === s);
    const onBoard = board.some((c) => c[1] === s);
    // Классический flush draw: ровно 4 одномастных (1 в руке + 3 на борде, либо 2+2) — добираем 5-ю за улицу.
    // При count <= 3 это backdoor-flush (шанс ~4%), он не считается аутом на одной улице.
    if (count === 4 && inHole && onBoard) {
      return remaining.filter((c) => c[1] === s);
    }
  }
  return [];
}

function getStraightOutCards(holeCards: Card[], board: Card[], remaining: Card[]): Card[] {
  const rankOrder: Record<string, number> = {
    '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
  };
  const values = [...holeCards, ...board].map((c) => rankOrder[c[0]] ?? -1);
  const needed = new Set<number>();
  for (let r = 0; r <= 12; r++) {
    const test = [...values, r];
    const sorted = [...new Set(test)].sort((a, b) => b - a);
    for (let i = 0; i <= sorted.length - 5; i++) {
      const run = sorted.slice(i, i + 5);
      if (run.length === 5 && run[0] - run[4] === 4) {
        needed.add(r);
        break;
      }
    }
  }
  return remaining.filter((c) => needed.has(rankOrder[c[0]] ?? -1));
}

/** Дро на каре: в руке+борде уже 3 карты одного ранга — оставшиеся карты этого ранга в колоде. */
function getQuadsOutCards(holeCards: Card[], board: Card[], remaining: Card[]): Card[] {
  const rankCount: Record<string, number> = {};
  for (const c of [...holeCards, ...board]) {
    const r = c[0];
    rankCount[r] = (rankCount[r] ?? 0) + 1;
  }
  for (const [rank, count] of Object.entries(rankCount)) {
    if (count === 3) {
      return remaining.filter((c) => c[0] === rank);
    }
  }
  return [];
}

function getOvercardOutCards(holeCards: Card[], board: Card[], remaining: Card[]): Card[] {
  const rankOrder: Record<string, number> = {
    '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
  };
  const boardMax = Math.max(...board.map((c) => rankOrder[c[0]] ?? 0));
  const outCards: Card[] = [];
  for (const c of holeCards) {
    const r = rankOrder[c[0]] ?? 0;
    if (r > boardMax) {
      outCards.push(...remaining.filter((x) => rankOrder[x[0]] === r));
    }
  }
  return outCards;
}
