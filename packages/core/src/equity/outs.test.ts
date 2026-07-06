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
});
