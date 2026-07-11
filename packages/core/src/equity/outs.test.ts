import { describe, it, expect } from 'vitest';
import { countOuts, totalOuts } from './outs';
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

  it('не считает ауты на готовом стрите (8h 9c на 6s 7d Th)', () => {
    // Регресс-тест на дефект №2: готовый стрит 6-7-8-9-T — аутов на «усиление до стрита» нет.
    const holeCards: Card[] = ['8h', '9c'];
    const board: Card[] = ['6s', '7d', 'Th'];

    const { total } = totalOuts(holeCards, board);
    expect(total).toBe(0);
  });

  it('не считает ауты на готовом стрите 5-хай (5h 6c на 3s 4d 7h)', () => {
    const holeCards: Card[] = ['5h', '6c'];
    const board: Card[] = ['3s', '4d', '7h'];

    const { total } = totalOuts(holeCards, board);
    expect(total).toBe(0);
  });

  it('не считает оверкарты-ауты на готовом флеше (Ah Kh на 9h 7h 3h)', () => {
    // Регресс-тест на дефект №2: готовый флеш — оверкарты не усиливают комбинацию.
    const holeCards: Card[] = ['Ah', 'Kh'];
    const board: Card[] = ['9h', '7h', '3h'];

    const results = countOuts(holeCards, board);
    const overcardOut = results.find((r) => r.description.startsWith('Оверкарты'));
    expect(overcardOut).toBeUndefined();

    const { total } = totalOuts(holeCards, board);
    expect(total).toBe(0);
  });

  it('считает ауты на усиление сета до фулл-хауса (8h 8c на 8d 7s 2h)', () => {
    // Сет — не «готовая рука» по нашему порогу (ниже стрита), ауты на каре осмысленны.
    const holeCards: Card[] = ['8h', '8c'];
    const board: Card[] = ['8d', '7s', '2h'];

    const results = countOuts(holeCards, board);
    const quadsOut = results.find((r) => r.description.startsWith('Дро на каре'));
    expect(quadsOut).toBeDefined();
    expect(quadsOut!.outs).toBe(1); // одна восьмёрка в колоде
  });
});
