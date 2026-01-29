import { RANKS, type Card, HandRank, type HandStrength } from './types';

const RANK_ORDER: Record<string, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i])
);

/** Числовое значение ранга (2=0, A=12) */
function rankValue(card: Card): number {
  return RANK_ORDER[card[0]] ?? -1;
}

/** Масть карты */
function suit(card: Card): string {
  return card[1];
}

/**
 * Оценка лучшей руки из 5–7 карт.
 * Упрощённая реализация: полный 7-карточный evaluator можно заменить
 * на быструю библиотеку (например, poker-evaluator) позже.
 */
export function evaluateHand(cards: Card[]): HandStrength {
  if (cards.length < 5) {
    return {
      rank: HandRank.HighCard,
      name: `Для оценки нужны 5 карт (сейчас ${cards.length})`,
      cards: [...cards].sort((a, b) => rankValue(b) - rankValue(a)),
      value: 0,
    };
  }

  const sorted = [...cards].sort((a, b) => rankValue(b) - rankValue(a));
  const byRank = groupByRank(sorted);
  const bySuit = groupBySuit(sorted);

  // Straight flush / Royal
  const sf = findStraightFlush(cards);
  if (sf) return sf;

  // Quads
  const quads = findGroup(byRank, 4);
  if (quads) {
    const kicker = sorted.find((c) => !quads.includes(c))!;
    return {
      rank: HandRank.FourOfAKind,
      name: 'Каре',
      cards: [...quads, kicker],
      value: rankValue(quads[0]) * 100 + rankValue(kicker),
    };
  }

  // Full house
  const trips = findGroup(byRank, 3);
  const pair = findGroup(byRank, 2, (c) => !trips?.includes(c));
  if (trips && pair) {
    return {
      rank: HandRank.FullHouse,
      name: 'Фулл-хаус',
      cards: [...trips, ...pair],
      value: rankValue(trips[0]) * 100 + rankValue(pair[0]),
    };
  }

  // Flush
  const flush = findFlush(bySuit);
  if (flush) return flush;

  // Straight
  const straight = findStraight(sorted);
  if (straight) return straight;

  // Trips
  if (trips) {
    const kickers = sorted.filter((c) => !trips.includes(c)).slice(0, 2);
    return {
      rank: HandRank.ThreeOfAKind,
      name: 'Сет',
      cards: [...trips, ...kickers],
      value: rankValue(trips[0]) * 10000 + rankValue(kickers[0]) * 100 + rankValue(kickers[1]),
    };
  }

  // Two pair
  const pairs = findAllPairs(byRank);
  if (pairs.length >= 2) {
    const [p1, p2] = pairs.slice(0, 2);
    const kicker = sorted.find((c) => !p1.includes(c) && !p2.includes(c))!;
    return {
      rank: HandRank.TwoPair,
      name: 'Две пары',
      cards: [...p1, ...p2, kicker],
      value: rankValue(p1[0]) * 10000 + rankValue(p2[0]) * 100 + rankValue(kicker),
    };
  }

  // One pair
  if (pairs.length === 1) {
    const kickers = sorted.filter((c) => !pairs[0].includes(c)).slice(0, 3);
    return {
      rank: HandRank.Pair,
      name: 'Пара',
      cards: [...pairs[0], ...kickers],
      value: rankValue(pairs[0][0]) * 1000000 + kickers.reduce((acc, c, i) => acc + rankValue(c) * Math.pow(100, 2 - i), 0),
    };
  }

  // High card
  return {
    rank: HandRank.HighCard,
    name: 'Старшая карта',
    cards: sorted.slice(0, 5),
    value: sorted.slice(0, 5).reduce((acc, c, i) => acc + rankValue(c) * Math.pow(100, 4 - i), 0),
  };
}

/** Лучшая рука из 2 карт игрока + борд (5 карт) */
export function evaluatePlayerHand(holeCards: Card[], board: Card[]): HandStrength {
  const all = [...holeCards, ...board];
  if (all.length < 5) return evaluateHand(all);
  const combos = combinations(all, 5);
  let best = evaluateHand(combos[0]);
  for (let i = 1; i < combos.length; i++) {
    const next = evaluateHand(combos[i]);
    if (next.rank > best.rank || (next.rank === best.rank && next.value > best.value)) {
      best = next;
    }
  }
  return best;
}

/** Сравнить две руки; возвращает 1 если a > b, -1 если b > a, 0 если ничья */
export function compareHands(a: HandStrength, b: HandStrength): number {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;
  return a.value > b.value ? 1 : a.value < b.value ? -1 : 0;
}

function groupByRank(cards: Card[]): Map<number, Card[]> {
  const m = new Map<number, Card[]>();
  for (const c of cards) {
    const r = rankValue(c);
    if (!m.has(r)) m.set(r, []);
    m.get(r)!.push(c);
  }
  return m;
}

function groupBySuit(cards: Card[]): Map<string, Card[]> {
  const m = new Map<string, Card[]>();
  for (const c of cards) {
    const s = suit(c);
    if (!m.has(s)) m.set(s, []);
    m.get(s)!.push(c);
  }
  return m;
}

function findGroup(
  byRank: Map<number, Card[]>,
  count: number,
  filter?: (c: Card) => boolean
): Card[] | null {
  const entries = [...byRank.entries()].sort((a, b) => b[0] - a[0]);
  for (const [, group] of entries) {
    const g = filter ? group.filter(filter) : group;
    if (g.length >= count) return g.slice(0, count);
  }
  return null;
}

function findAllPairs(byRank: Map<number, Card[]>): Card[][] {
  const pairs: Card[][] = [];
  const entries = [...byRank.entries()].sort((a, b) => b[0] - a[0]);
  for (const [, group] of entries) {
    if (group.length >= 2) pairs.push(group.slice(0, 2));
  }
  return pairs;
}

function findStraightFlush(cards: Card[]): HandStrength | null {
  const bySuit = groupBySuit(cards);
  for (const [, group] of bySuit) {
    if (group.length < 5) continue;
    const s = findStraight(group);
    if (s) {
      s.name = s.rank === HandRank.RoyalFlush ? 'Роял-флеш' : 'Стрит-флеш';
      s.rank = s.rank === HandRank.Straight && rankValue(s.cards[0]) === 12 ? HandRank.RoyalFlush : HandRank.StraightFlush;
      return s;
    }
  }
  return null;
}

function findStraight(cards: Card[]): HandStrength | null {
  const values = [...new Set(cards.map(rankValue))].sort((a, b) => b - a);
  for (const v of values) {
    const run = [v];
    for (let k = 1; k < 5; k++) {
      const next = v - k;
      if (next < 0 && v === 12) {
        if (values.includes(3)) run.push(3);
      } else if (values.includes(next)) {
        run.push(next);
      } else break;
    }
    if (run.length === 5) {
      const straightCards = run
        .map((r) => cards.find((c) => rankValue(c) === r)!)
        .filter(Boolean);
      const high = run[0] === 12 && run.includes(3) ? 3 : run[0];
      return {
        rank: HandRank.Straight,
        name: 'Стрит',
        cards: straightCards.slice(0, 5),
        value: high,
      };
    }
  }
  return null;
}

function findFlush(bySuit: Map<string, Card[]>): HandStrength | null {
  for (const [, group] of bySuit) {
    if (group.length >= 5) {
      const sorted = group.sort((a, b) => rankValue(b) - rankValue(a)).slice(0, 5);
      const value = sorted.reduce((acc, c, i) => acc + rankValue(c) * Math.pow(100, 4 - i), 0);
      return {
        rank: HandRank.Flush,
        name: 'Флеш',
        cards: sorted,
        value,
      };
    }
  }
  return null;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}
