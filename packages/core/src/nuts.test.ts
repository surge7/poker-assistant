import { describe, it, expect } from 'vitest';
import { getNuts, compareToNuts } from './nuts';
import type { Card } from './types';
import { HandRank } from './types';

describe('натс на неполный борд (флоп/терн)', () => {
  it('getNuts возвращает натс на флопе (3 карты), а не null', () => {
    // Флоп: Ah Kh Qh — лучший возможный борд. Натс — стрит-флешBroadway с Jh Th.
    const board: Card[] = ['Ah', 'Kh', 'Qh'];
    const nuts = getNuts(board);
    expect(nuts).not.toBeNull();
    // На трёх картах с тремя старшими червами лучшая возможная рука — флеш или стрит-флеш.
    expect(nuts!.rank).toBeGreaterThanOrEqual(HandRank.Flush);
  });

  it('getNuts возвращает натс на терне (4 карты), а не null', () => {
    const board: Card[] = ['Ah', 'Kh', 'Qh', 'Js'];
    const nuts = getNuts(board);
    expect(nuts).not.toBeNull();
  });

  it('compareToNuts.isNuts работает на флопе', () => {
    // Флоп Ah Kh Qh. Игрок держит Jh Th → стрит-флеш Broadway → это натс.
    const board: Card[] = ['Ah', 'Kh', 'Qh'];
    const result = compareToNuts(['Jh', 'Th'], board);
    expect(result.isNuts).toBe(true);
  });

  it('compareToNuts.isNuts false, когда рука слабее натса на флопе', () => {
    // Тот же флоп Ah Kh Qh, но игрок держит 2c 3d (мусор) → точно не натс.
    const board: Card[] = ['Ah', 'Kh', 'Qh'];
    const result = compareToNuts(['2c', '3d'], board);
    expect(result.isNuts).toBe(false);
  });

  it('натс на ривере (5 карт) работает как раньше', () => {
    const board: Card[] = ['Ah', 'Kh', 'Qh', 'Js', '2c'];
    const nuts = getNuts(board);
    expect(nuts).not.toBeNull();
  });
});
