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

describe('эквити против диапазонов оппонентов (VPIP)', () => {
  it('AA vs нит (VPIP 12) даёт НИЖЕ эквити, чем vs случайная рука', () => {
    // Нит разыгрывает топ-~17% рук — его диапазон сильнее среднего: KK/QQ/JJ/TT/99/88/77
    // и сильные тузы (AK/AQ/AJ/AT). Против такого диапазона AA выигрывает реже,
    // т.к. оппонент чаще попадает в сет/две пары/доминируемый туз.
    const vsRandom = equityPercent(['Ah', 'Ad'], [], 1, 3000);
    const nitOpp = [{ position: 1, stats: { vpip: 12, pfr: 10 } }];
    const vsNit = equityPercent(['Ah', 'Ad'], [], 1, 3000, nitOpp);
    expect(vsNit).toBeLessThan(vsRandom);
  });

  it('AA vs маньяк (VPIP 60) даёт эквити, близкое к случайной руке', () => {
    // Маньяк разыгрывает топ-65% — почти весь спектр, близко к случайной.
    const vsRandom = equityPercent(['Ah', 'Ad'], [], 1, 3000);
    const maniacOpp = [{ position: 1, stats: { vpip: 60, pfr: 45 } }];
    const vsManiac = equityPercent(['Ah', 'Ad'], [], 1, 3000, maniacOpp);
    expect(Math.abs(vsRandom - vsManiac)).toBeLessThan(6);
  });

  it('оппонент без stats (unknown) = случайная рука (обратная совместимость)', () => {
    const vsRandom = equityPercent(['Ah', 'Ad'], [], 1, 2000);
    const unknownOpp = [{ position: 1 }]; // без stats
    const vsUnknown = equityPercent(['Ah', 'Ad'], [], 1, 2000, unknownOpp);
    expect(vsUnknown).toBe(vsRandom); // идентично (тот же seed, тот же путь раздачи)
  });

  it('без opponents — обратная совместимость (как раньше)', () => {
    const a = equityPercent(['Ah', 'Kh'], [], 1, 2000);
    const b = equityPercent(['Ah', 'Kh'], [], 1, 2000);
    expect(a).toBe(b); // детерминизм сохранён
  });
});

describe('доля банка при chop (multiway tie)', () => {
  // Регрессия на дефект #14: формула tie/2 переоценивала долю банка в multiway chop.
  // Правильная семантика equity — ожидаемая доля пота: при chop с N игроками наша доля = 1/(N+1).

  it('royal flush на борде vs 1 → 50% (heads-up chop, 1/2)', () => {
    const board: Card[] = ['Th', 'Jh', 'Qh', 'Kh', 'Ah'];
    expect(equityPercent(['2c', '3d'], board, 1, 5000)).toBe(50);
  });

  it('royal flush на борде vs 5 → ~17% (5-way chop, 1/6)', () => {
    // Раньше: 50% (tie/2). Теперь: 1/6 ≈ 17%.
    const board: Card[] = ['Th', 'Jh', 'Qh', 'Kh', 'Ah'];
    const eq = equityPercent(['2c', '3d'], board, 5, 5000);
    expect(eq).toBeGreaterThanOrEqual(15);
    expect(eq).toBeLessThanOrEqual(19);
  });

  it('royal flush на борде: доля уменьшается с числом оппонентов', () => {
    const board: Card[] = ['Th', 'Jh', 'Qh', 'Kh', 'Ah'];
    const e1 = equityPercent(['2c', '3d'], board, 1, 5000);
    const e3 = equityPercent(['2c', '3d'], board, 3, 5000);
    const e8 = equityPercent(['2c', '3d'], board, 8, 5000);
    expect(e1).toBeGreaterThan(e3);
    expect(e3).toBeGreaterThan(e8);
  });

  it('нормальные руки (без chop) не зависят от новой формулы — AA vs 8 ≈ 34%', () => {
    // Регрессия: фикс chop не должен сломать обычные сценарии (tie ≈ 0).
    const eq = equityPercent(['Ah', 'Ad'], [], 8, 5000);
    expect(eq).toBeGreaterThanOrEqual(31);
    expect(eq).toBeLessThanOrEqual(37);
  });

  it('AKs vs 1 (heads-up) — tie/2 формула сохранена, ≈ 67%', () => {
    const eq = equityPercent(['Ah', 'Kh'], [], 1, 5000);
    expect(eq).toBeGreaterThanOrEqual(63);
    expect(eq).toBeLessThanOrEqual(71);
  });

  it('натс-флеш на ривере vs 5 → ~99% (почти всегда чистая победа)', () => {
    // Регрессия: nut flush почти не chop'ится — equity должна быть высокой.
    const board: Card[] = ['9h', '7h', '3h', '2h', '5h'];
    const eq = equityPercent(['Ah', 'Kh'], board, 5, 5000);
    expect(eq).toBeGreaterThanOrEqual(95);
  });
});
