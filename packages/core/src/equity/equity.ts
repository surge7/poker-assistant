import { createDeck, fillRemaining, shuffleInPlace } from '../eval/deck';
import { evaluatePlayerHand, compareHands } from '../eval/hand-eval';
import { DEFAULT_ITERATIONS } from '../config/simulation';
import { statsToRange } from '../players/ranges';
import { SUITS, type Card } from '../types';
import type { Opponent } from '../players/profiles';

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
 * Развернуть код стартовой руки в конкретные 2-карточные комбинации.
 * "AA" → 6 карманных пар (все пары мастей).
 * "AKs" → 4 одномастных комбинации (по одной на каждую масть).
 * "AKo" → 12 разномастных комбинаций.
 * Возвращает массив комбинаций; каждая комбинация — массив из двух карт.
 */
function handCodeToCombos(code: string): Card[][] {
  const r1 = code[0];
  const r2 = code[1];
  const mod = code[2]; // 's' | 'o' | undefined (пара)
  const combos: Card[][] = [];
  if (r1 === r2) {
    // Пара: все сочетания из 4 мастей по 2 = 6 комбинаций.
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        combos.push([`${r1}${SUITS[i]}`, `${r2}${SUITS[j]}`]);
      }
    }
  } else if (mod === 's') {
    // Одномастные: 4 комбинации (по одной на каждую масть).
    for (const s of SUITS) combos.push([`${r1}${s}`, `${r2}${s}`]);
  } else {
    // Offsuit: 12 комбинаций (все пары мастей, кроме совпадающих).
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 !== s2) combos.push([`${r1}${s1}`, `${r2}${s2}`]);
      }
    }
  }
  return combos;
}

/**
 * Развернуть список кодов рук (из statsToRange) в плоский массив 2-карточных комбинаций.
 */
function rangeToCombos(codes: readonly string[]): Card[][] {
  const out: Card[][] = [];
  for (const c of codes) {
    for (const combo of handCodeToCombos(c)) out.push(combo);
  }
  return out;
}

/**
 * Раздать 2 карты оппоненту.
 * Если combos непустой — взять первую (после детерминированного перемешивания) комбинацию,
 * обе карты которой свободны (не в used и присутствуют в pool).
 * Если combos пуст или нет ни одной свободной комбинации — fallback к 2 картам из pool
 * (та же логика, что и до фичи профилей:splice(0,2) — сохраняет обратную совместимость).
 * Выбранные карты удаляются из pool (splice) и помечаются в used. combos НЕ мутируется.
 */
function dealOpponent(
  combos: Card[][],
  pool: Card[],
  random: () => number,
  used: Set<Card>,
): Card[] {
  if (combos.length > 0) {
    // Перемешать индексы combos детерминированно (Fisher–Yates по индексам).
    const order = combos.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Найти первую свободную комбинацию (обе карты не в used и есть в pool).
    for (const idx of order) {
      const combo = combos[idx];
      if (!used.has(combo[0]) && !used.has(combo[1])) {
        const p1 = pool.indexOf(combo[0]);
        const p2 = pool.indexOf(combo[1]);
        if (p1 >= 0 && p2 >= 0) {
          // Удалить обе из pool (сначала больший индекс, чтобы не сбить позицию второй).
          if (p1 > p2) {
            pool.splice(p1, 1);
            pool.splice(p2, 1);
          } else {
            pool.splice(p2, 1);
            pool.splice(p1, 1);
          }
          used.add(combo[0]);
          used.add(combo[1]);
          return [combo[0], combo[1]];
        }
      }
    }
  }
  // Fallback: 2 случайные карты из начала pool — как в исходной версии.
  const c1 = pool.splice(0, 1)[0];
  const c2 = pool.splice(0, 1)[0];
  used.add(c1);
  used.add(c2);
  return [c1, c2];
}

/**
 * Эквити (доля выигрыша) через симуляцию Монте-Карло.
 * Наша рука: holeCards + board. Остальные карты раздаются противникам (numOpponents),
 * затем доделывается борд до 5 карт. Считаем доли побед/разделов.
 * Используется фиксированный сид от входных данных — при одинаковых параметрах результат не скачет.
 * Оптимизация: один раз создаём колоду и буфер remaining, в цикле — fillRemaining + shuffleInPlace без аллокаций.
 *
 * opponents (опц.): метрики оппонентов по позициям. Если у оппонента есть stats с vpip>0,
 * ему раздаются карты из его диапазона (топ-N% рук по VPIP), а не случайные.
 * Оппонент без stats → случайная рука (обратная совместимость).
 */
export function equity(
  holeCards: Card[],
  board: Card[],
  numOpponents: number = 1,
  iterations: number = DEFAULT_ITERATIONS,
  opponents?: Opponent[],
): { win: number; tie: number; lose: number; total: number } {
  if (holeCards.length !== 2) {
    return { win: 0, tie: 0, lose: 1, total: 0 };
  }

  const deck = createDeck();
  const dead = [...holeCards, ...board];
  const deadSet = new Set(dead);
  const needBoard = 5 - board.length;
  const needOpponents = numOpponents * 2;
  const minRemaining = needBoard + needOpponents;
  const remaining: Card[] = [];
  const seed = hashInput(holeCards, board, numOpponents);
  const random = seededRandom(seed);
  let wins = 0;
  let ties = 0;
  let losses = 0;

  // Предвычислить комбинации диапазонов оппонентов один раз (кеш).
  // Пустой массив = случайная рука из pool (fallback).
  const oppCombos: Card[][][] = [];
  for (let o = 0; o < numOpponents; o++) {
    const opp = opponents?.[o];
    if (opp?.stats && opp.stats.vpip > 0) {
      const codes = statsToRange(opp.stats);
      oppCombos.push(codes.length > 0 ? rangeToCombos(codes) : []);
    } else {
      oppCombos.push([]); // пустой = случайная рука (как раньше)
    }
  }

  for (let i = 0; i < iterations; i++) {
    fillRemaining(deck, deadSet, remaining);
    if (remaining.length < minRemaining) continue;
    shuffleInPlace(remaining, random);

    // Множество карт, уже распределённых в этой итерации (наши + борд + розданные оппонентам).
    const usedInDeal = new Set<Card>([...holeCards, ...board]);

    const newBoard = board.length === 5 ? board : [...board, ...remaining.splice(0, needBoard)];
    for (const c of newBoard) usedInDeal.add(c);
    const ourHand = evaluatePlayerHand(holeCards, newBoard);

    let bestOpp = evaluatePlayerHand(dealOpponent(oppCombos[0], remaining, random, usedInDeal), newBoard);
    for (let o = 1; o < numOpponents; o++) {
      const oppHand = evaluatePlayerHand(dealOpponent(oppCombos[o], remaining, random, usedInDeal), newBoard);
      if (compareHands(oppHand, bestOpp) > 0) bestOpp = oppHand;
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
  iterations: number = DEFAULT_ITERATIONS,
  opponents?: Opponent[],
): number {
  const e = equity(holeCards, board, numOpponents, iterations, opponents);
  return Math.round((e.win + e.tie / 2) * 100);
}

/** Эквити в процентах и диапазон (нижняя — верхняя граница, ~95% доверительный интервал) */
export function equityPercentRange(
  holeCards: Card[],
  board: Card[],
  numOpponents: number = 1,
  iterations: number = DEFAULT_ITERATIONS,
  opponents?: Opponent[],
): { percent: number; low: number; high: number } {
  const e = equity(holeCards, board, numOpponents, iterations, opponents);
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
