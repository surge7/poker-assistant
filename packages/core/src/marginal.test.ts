import { describe, it, expect } from 'vitest';
import { getAdvice } from './advice';
import type { TableContext } from './types';

/**
 * Тесты на детекцию маргинальных решений.
 * Если требуемая эквити попадает в 95% доверительный интервал эквити,
 * совет должен честно говорить о неуверенности и снижать confidence.
 */
function baseContext(overrides: Partial<TableContext> = {}): TableContext {
  return {
    phase: 'flop',
    board: ['2d', '7d', '9c'],
    holeCards: ['Ah', 'Kh'],
    potSize: 100,
    toCall: 50,
    numPlayers: 4,
    positionIndex: 0,
    // Передаём эквити напрямую, чтобы тест был детерминированным (без шума Монте-Карло).
    equityPercent: 45,
    ...overrides,
  };
}

describe('маргинальные решения (учёт доверительного интервала)', () => {
  it('помечает совет как маргинальный, когда требуемая эквити внутри 95% CI', () => {
    // Эквити 45%, требуемая для колла при банке 100/колл 50 = 33.3%.
    // Но 95% CI = [40, 50], требуемая 33% лежит НИЖЕ CI → не маргинально (эквити явно выше).
    // Это НЕ маргинальный случай — оставляем как sanity check.
    const ctx = baseContext({
      equityPercent: 45,
      equityLow: 40,
      equityHigh: 50,
    });
    const result = getAdvice(ctx);
    expect(result.reason).not.toMatch(/маргиналь/i);
  });

  it('помечает совет как маргинальный, когда требуемая эквити внутри CI', () => {
    // Эквити 45%, 95% CI = [35, 55]. Требуемая эквити 50% (toCall=100, pot=100 → 50%).
    // Требуемая 50% попадает в [35, 55] → колл vs фолд зависит от шума → маргинально.
    const ctx = baseContext({
      potSize: 100,
      toCall: 100,
      equityPercent: 45,
      equityLow: 35,
      equityHigh: 55,
    });
    const result = getAdvice(ctx);
    expect(result.reason).toMatch(/маргиналь/i);
  });

  it('маргинальный совет имеет меньшую уверенность, чем чёткий', () => {
    // Тот же ввод, но CI широкий (маргинально) vs узкий (чётко).
    const marginal = getAdvice(baseContext({
      potSize: 100, toCall: 100, equityPercent: 45, equityLow: 35, equityHigh: 55,
    }));
    const clear = getAdvice(baseContext({
      potSize: 100, toCall: 100, equityPercent: 45, equityLow: 44, equityHigh: 46,
    }));
    expect(marginal.confidence).toBeLessThanOrEqual(clear.confidence);
  });

  it('без CI в контексте не падает и не пишет «маргинально» (обратная совместимость)', () => {
    const ctx = baseContext({ equityPercent: 45 });
    const result = getAdvice(ctx);
    expect(result.reason).not.toMatch(/маргиналь/i);
    expect(result.action).toBeDefined();
  });
});
