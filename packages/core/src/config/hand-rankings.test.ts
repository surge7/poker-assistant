import { describe, it, expect } from 'vitest';
import { HAND_RANKINGS, topPercentHands } from './hand-rankings';

describe('hand-rankings (169 рук Sklansky)', () => {
  it('содержит ровно 169 уникальных рук', () => {
    expect(HAND_RANKINGS).toHaveLength(169);
    expect(new Set(HAND_RANKINGS).size).toBe(169);
  });

  it('AA — первая рука, 22 или 72o — последняя', () => {
    expect(HAND_RANKINGS[0]).toBe('AA');
    // Самая слабая рука в стандартном ранжировании — 72o
    expect(['22', '72o']).toContain(HAND_RANKINGS[168]);
  });

  it('каждая рука валидного формата (пара / suited / offsuit)', () => {
    for (const h of HAND_RANKINGS) {
      // Пара: 2 одинаковых ранга (KK). Suited: r+s (AKs). Offsuit: r+o (AKo).
      expect(h).toMatch(/^([2-9TJQKA]{2}|[2-9TJQKA][2-9TJQKA][so])$/);
    }
  });

  it('topPercentHands(20) ≈ 34 руки', () => {
    expect(topPercentHands(20)).toHaveLength(34); // round(20/100 * 169) = 34
  });

  it('topPercentHands(0) — пусто, topPercentHands(100) — все 169', () => {
    expect(topPercentHands(0)).toHaveLength(0);
    expect(topPercentHands(100)).toHaveLength(169);
  });
});
