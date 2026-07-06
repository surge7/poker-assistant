import { describe, it, expect } from 'vitest';
import { raiseFactor } from './profiles';
import type { PlayerStats } from './profiles';

describe('players/profiles — raiseFactor (PFR/VPIP)', () => {
  it('агрессивность = PFR/VPIP', () => {
    const tag: PlayerStats = { vpip: 22, pfr: 18 };
    expect(raiseFactor(tag)).toBeCloseTo(0.818, 2); // 18/22
  });

  it('TAG: высокий raiseFactor (~0.8+)', () => {
    const tag: PlayerStats = { vpip: 20, pfr: 17 };
    expect(raiseFactor(tag)).toBeGreaterThan(0.8);
  });

  it('пассивный фиш: низкий raiseFactor (<0.5)', () => {
    const fish: PlayerStats = { vpip: 50, pfr: 10 };
    expect(raiseFactor(fish)).toBeLessThan(0.5);
  });

  it('VPIP=0 → raiseFactor=0 (нет данных)', () => {
    expect(raiseFactor({ vpip: 0, pfr: 0 })).toBe(0);
  });
});
