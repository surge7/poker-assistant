import { describe, it, expect } from 'vitest';
import { statsToRange } from './ranges';
import type { PlayerStats } from './profiles';

describe('players/ranges — statsToRange', () => {
  it('vpip<=0 (неизвестный игрок) → пустой массив (сигнал «случайная рука»)', () => {
    expect(statsToRange({ vpip: 0, pfr: 0 })).toEqual([]);
  });

  it('TAG (VPIP=22) → непустой диапазон ~25% рук', () => {
    const range = statsToRange({ vpip: 22, pfr: 18 });
    expect(range.length).toBeGreaterThan(0);
    // ~25% из 169 = ~42 руки. Допуск ±10.
    expect(range.length).toBeGreaterThan(30);
    expect(range.length).toBeLessThan(55);
  });

  it('Нит (VPIP=12) уже чем TAG (VPIP=22)', () => {
    const nit = statsToRange({ vpip: 12, pfr: 10 });
    const tag = statsToRange({ vpip: 22, pfr: 18 });
    expect(nit.length).toBeLessThan(tag.length);
  });

  it('Маньяк (VPIP=60) шире всех', () => {
    const maniac = statsToRange({ vpip: 60, pfr: 45 });
    const nit = statsToRange({ vpip: 12, pfr: 10 });
    expect(maniac.length).toBeGreaterThan(nit.length);
    // ~65% из 169 = ~110 рук.
    expect(maniac.length).toBeGreaterThan(90);
  });

  it('AA всегда в диапазоне любого игрока (кроме unknown)', () => {
    const tag = statsToRange({ vpip: 22, pfr: 18 } as PlayerStats);
    expect(tag).toContain('AA');
  });
});
