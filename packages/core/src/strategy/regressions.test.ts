import { describe, it, expect } from 'vitest';
import { evaluatePlayerHand, compareHands } from '../eval/hand-eval';
import { countOuts, totalOuts } from '../equity/outs';
import { HandRank } from '../types';
import type { Card } from '../types';

/**
 * Регрессионные тесты на баги, найденные при аудите математики.
 * Каждый тест ловит конкретный, ранее подтверждённый экспериментально дефект.
 */
describe('регрессии: математика ядра', () => {
  describe('баг #2: флеш-дро считается при недостаточном числе одномастных карт', () => {
    it('не считает флеш-дро, когда одномастных карт всего 2 (backdoor, не дро)', () => {
      // Ah Kd на борде 2c 7d 9h: червы = Ah + 9h (всего 2) — это не флеш-дро.
      const holeCards: Card[] = ['Ah', 'Kd'];
      const board: Card[] = ['2c', '7d', '9h'];

      const results = countOuts(holeCards, board);

      const flushOut = results.find((r) => r.description.startsWith('Флеш-дро'));
      expect(flushOut).toBeUndefined();
    });

    it('не считает флеш-дро при 3 одномастных на флопе (тоже backdoor)', () => {
      // Ah Kh + 2h 7c 9d: червы = Ah, Kh, 2h (3 карты) — нужно ещё 2, это backdoor, не классическое дро.
      const holeCards: Card[] = ['Ah', 'Kh'];
      const board: Card[] = ['2h', '7c', '9d'];

      const results = countOuts(holeCards, board);

      const flushOut = results.find((r) => r.description.startsWith('Флеш-дро'));
      expect(flushOut).toBeUndefined();
    });

    it('считает флеш-дро при 4 одномастных (классический flush draw = 9 аутов)', () => {
      // Ah Kh + 2h 7h 9c: червы = 4 → 9 аутов до флеша.
      const holeCards: Card[] = ['Ah', 'Kh'];
      const board: Card[] = ['2h', '7h', '9c'];

      const results = countOuts(holeCards, board);

      const flushOut = results.find((r) => r.description.startsWith('Флеш-дро'));
      expect(flushOut).toBeDefined();
      expect(flushOut!.outs).toBe(9);
    });
  });

  describe('баг #1: wheel-стрит (A-2-3-4-5) не определяется', () => {
    it('оценивает A-2-3-4-5 как стрит (а не как старшую карту)', () => {
      const holeCards: Card[] = ['Ah', '2d'];
      const board: Card[] = ['3c', '4s', '5h', 'Kc', 'Qd'];

      const hand = evaluatePlayerHand(holeCards, board);

      expect(hand.rank).toBe(HandRank.Straight);
      expect(hand.name).toBe('Стрит');
    });

    it('оценивает стальной wheel Ah-2h-3h-4h-5h как стрит-флеш (а не как флеш)', () => {
      const holeCards: Card[] = ['Ah', '2h'];
      const board: Card[] = ['3h', '4h', '5h', 'Kc', 'Qd'];

      const hand = evaluatePlayerHand(holeCards, board);

      expect(hand.rank).toBe(HandRank.StraightFlush);
    });

    it('обычный стрит 6-high сильнее wheel 5-high', () => {
      // 6-high стрит: 2-3-4-5-6
      const six = evaluatePlayerHand(['6d', '2c'], ['3h', '4s', '5d', 'Ah', 'Kc']);
      // wheel: A-2-3-4-5
      const five = evaluatePlayerHand(['Ah', '2d'], ['3c', '4s', '5h', 'Kc', 'Qd']);

      expect(six.rank).toBe(HandRank.Straight);
      expect(five.rank).toBe(HandRank.Straight);
      expect(compareHands(six, five)).toBeGreaterThan(0);
    });
  });

  describe('баг #3: totalOuts считает пересекающиеся ауты дважды', () => {
    it('не двойной счёт карт, которые дают и флеш, и стрит одновременно', () => {
      // Ah Kh + Qh Jh 2c на флопе:
      //   - флеш-дро: 9 черв (2h-9h, Th)
      //   - стрит-дро Broadway: 4 десятки (Ts Th Td Tc) — Th пересекается с флешем
      //   - оверкарты: 6 (As Ad Ac Ks Kd Kc) — не пересекаются ни с чем
      // Th даёт И флеш, И стрит — должна считаться один раз.
      // До фикса: 9 + 4 + 6 = 19 (Th посчитана дважды). После: 9 + 3 + 6 = 18.
      const holeCards: Card[] = ['Ah', 'Kh'];
      const board: Card[] = ['Qh', 'Jh', '2c'];

      const { total } = totalOuts(holeCards, board);

      // Корректное число уникальных аутов = 18. Th учтена один раз.
      expect(total).toBe(18);
    });
  });
});
