import { describe, it, expect } from 'vitest';
import { countOuts } from './outs';
import type { Card } from '../types';

describe('countOuts', () => {
  it('не считает флеш-дро, если в руке одна масть, на борде другая', () => {
    // Рука: 10♥ J♥ (червы). Борд: 6♦ 5♦ 5♦ (буби). Флеш по одной масти собрать нельзя.
    const holeCards: Card[] = ['Th', 'Jh'];
    const board: Card[] = ['6d', '5d', '5d'];

    const results = countOuts(holeCards, board);

    const flushOut = results.find((r) => r.description.startsWith('Флеш-дро'));
    expect(flushOut).toBeUndefined();
  });

  it('считает флеш-дро, если одна масть есть и в руке, и на борде', () => {
    // Рука: 10♥ J♥. Борд: 6♥ 5♥ 2♦ — червы и в руке, и на борде.
    const holeCards: Card[] = ['Th', 'Jh'];
    const board: Card[] = ['6h', '5h', '2d'];

    const results = countOuts(holeCards, board);

    const flushOut = results.find((r) => r.description.startsWith('Флеш-дро'));
    expect(flushOut).toBeDefined();
    expect(flushOut!.outs).toBe(9); // 13 − 4 = 9 червей осталось в колоде
  });

  it('считает стрит-ауты для wheel-дро (A-2-3-4, нужна 5)', () => {
    // Рука Ah 2d + борд 3c 4s 9h: держим A-2-3-4, пятёрка даёт wheel-стрит A-2-3-4-5.
    // Ожидаем 4 аута (4 пятёрки в колоде).
    const holeCards: Card[] = ['Ah', '2d'];
    const board: Card[] = ['3c', '4s', '9h'];

    const results = countOuts(holeCards, board);

    const straightOut = results.find((r) => r.description.startsWith('Стрит-дро'));
    expect(straightOut).toBeDefined();
    expect(straightOut!.outs).toBe(4); // 4 пятёрки
  });

  it('считает стрит-ауты для wheel-дро с тузом и тройкой-четвёркой (без двойки)', () => {
    // Рука Ah 3d + борд 4s 5c 9h: держим A-3-4-5, двойка даёт wheel-стрит A-2-3-4-5.
    // Шестёрка стрит не даёт (нет 7 для 3-4-5-6-7), поэтому только 4 аута (двойки).
    const holeCards: Card[] = ['Ah', '3d'];
    const board: Card[] = ['4s', '5c', '9h'];

    const results = countOuts(holeCards, board);

    const straightOut = results.find((r) => r.description.startsWith('Стрит-дро'));
    expect(straightOut).toBeDefined();
    expect(straightOut!.outs).toBe(4); // только 4 двойки для wheel
  });
});
