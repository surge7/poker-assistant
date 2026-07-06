import { describe, it, expect } from 'vitest';
import { equity, equityPercent } from './equity';
import type { Card } from '../types';

/**
 * Тесты точности Монте-Карло против известных эталонов эквити (PokerStove и др.).
 * Границы — щедрые из-за природы Монте-Карло, но достаточно узкие, чтобы ловить
 * слишком малое число итераций (раньше дефолт 500 давал разброс ±6%).
 */
describe('точность эквити Монте-Карло (дефолтные итерации)', () => {
  // Эталоны эквити heads-up (префлоп), хорошо известные из PokerStove.
  const cases: Array<{ name: string; hole: Card[]; ref: number; tol: number }> = [
    { name: 'AA vs 1', hole: ['Ah', 'Ad'], ref: 85, tol: 3 },
    { name: 'KK vs 1', hole: ['Kh', 'Kd'], ref: 82, tol: 3 },
    { name: 'AKs vs 1', hole: ['Ah', 'Kh'], ref: 67, tol: 4 },
    { name: 'AKo vs 1', hole: ['Ah', 'Kd'], ref: 65, tol: 4 },
    { name: 'JT suited vs 1', hole: ['Th', 'Jh'], ref: 54, tol: 4 },
    { name: '72o vs 1', hole: ['7h', '2d'], ref: 35, tol: 4 },
  ];

  for (const { name, hole, ref, tol } of cases) {
    it(`${name}: дефолтное эквити ≈ ${ref}% (±${tol})`, () => {
      // Дефолтное число итераций — без явного аргумента.
      const eq = equityPercent(hole, []);
      expect(eq).toBeGreaterThanOrEqual(ref - tol);
      expect(eq).toBeLessThanOrEqual(ref + tol);
    });
  }

  it('результат детерминирован (одинаковый ввод → одинаковый результат)', () => {
    const a = equityPercent(['Ah', 'Kh'], [], 1);
    const b = equityPercent(['Ah', 'Kh'], [], 1);
    expect(a).toBe(b);
  });
});
