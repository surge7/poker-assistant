import { describe, it, expect } from 'vitest';
import {
  getPositionName,
  getTablePositions,
  isLatePosition,
  clampPositionIndex,
} from './positions';

describe('positions', () => {
  it('имена позиций зависят от числа игроков', () => {
    expect(getPositionName(0, 2)).toBe('BTN/SB');
    expect(getPositionName(1, 2)).toBe('BB');

    expect(getPositionName(0, 3)).toBe('BTN');
    expect(getPositionName(2, 3)).toBe('BB');

    expect(getTablePositions(4).map((p) => p.name)).toEqual(['BTN', 'SB', 'BB', 'CO']);
    expect(getTablePositions(6).map((p) => p.name)).toEqual(['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO']);
    expect(getTablePositions(10).map((p) => p.name)).toEqual([
      'BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO',
    ]);
  });

  it('поздняя позиция — только BTN и CO (если есть)', () => {
    expect(isLatePosition(0, 2)).toBe(true);
    expect(isLatePosition(1, 2)).toBe(false);

    expect(isLatePosition(0, 3)).toBe(true);
    expect(isLatePosition(2, 3)).toBe(false);

    expect(isLatePosition(3, 4)).toBe(true); // CO
    expect(isLatePosition(2, 4)).toBe(false); // BB

    expect(isLatePosition(5, 6)).toBe(true); // CO
    expect(isLatePosition(3, 6)).toBe(false); // UTG
  });

  it('ограничивает индекс позиции числом игроков', () => {
    expect(clampPositionIndex(5, 4)).toBe(3);
    expect(clampPositionIndex(-1, 6)).toBe(0);
  });
});
