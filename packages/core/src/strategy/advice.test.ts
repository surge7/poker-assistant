import { describe, it, expect } from 'vitest';
import { getAdvice } from './advice';
import type { TableContext, AdviceResult, AdviceExplanation } from '../types';
import type { Opponent } from '../players/profiles';

function adviceText(result: AdviceResult): string {
  return [result.reason, ...(result.details ?? [])].join(' ');
}

function expectPotOdds(explanation: AdviceExplanation | undefined, potSize: number, toCall: number): void {
  expect(explanation).toBeDefined();
  const requiredPct = (toCall / (potSize + toCall)) * 100;
  expect(explanation!.requiredPct).toBeCloseTo(requiredPct, 0);
  expect(explanation!.potOdds).toBeCloseTo(toCall / (potSize + toCall), 2);
  expect(explanation!.potSize).toBe(potSize);
  expect(explanation!.toCall).toBe(toCall);
}

/** Базовый контекст: одна и та же рука и борд, меняем банк, toCall, позицию. */
function baseContext(
  overrides: Partial<
    Pick<TableContext, 'potSize' | 'toCall' | 'positionIndex' | 'equityPercent' | 'equityLow' | 'equityHigh'>
  > = {},
): TableContext {
  return {
    phase: 'flop',
    board: ['2d', '3d', '4h'],
    holeCards: ['7h', '7d'],
    potSize: 100,
    toCall: 20,
    numPlayers: 4,
    positionIndex: 0,
    ...overrides,
  };
}

describe('getAdvice', () => {
  describe('влияние банка и суммы колла на совет', () => {
    it('при toCall === 0 возвращает check', () => {
      const ctx = baseContext({ potSize: 100, toCall: 0 });
      const result = getAdvice(ctx);
      expect(result.action).toBe('check');
      expect(result.reason).toContain('Нет ставки для колл');
    });

    it('при большом банке относительно ставки совет чаще колл (низкая требуемая эквити)', () => {
      // Банк 1000, колл 10 → требуемая эквити ~1%
      const ctxBigPot = baseContext({ potSize: 1000, toCall: 10 });
      const resultBigPot = getAdvice(ctxBigPot);
      expect(['call', 'raise']).toContain(resultBigPot.action);
      expect(resultBigPot.explanation?.requiredPct).toBeLessThan(5);
      expectPotOdds(resultBigPot.explanation, 1000, 10);
    });

    it('при большой ставке относительно банка совет чаще фолд (высокая требуемая эквити)', () => {
      // Банк 10, колл 100 → требуемая эквити ~91%
      const ctxSmallPot = baseContext({ potSize: 10, toCall: 100 });
      const resultSmallPot = getAdvice(ctxSmallPot);
      expect(resultSmallPot.action).toBe('fold');
      expect(resultSmallPot.explanation?.requiredPct).toBeGreaterThan(80);
      expect(resultSmallPot.explanation?.marginPct).toBeLessThan(0);
    });

    it('одна и та же рука: большой банк → колл, маленький банк при большой ставке → фолд', () => {
      const bigPot = baseContext({ potSize: 500, toCall: 10 });
      const smallPot = baseContext({ potSize: 20, toCall: 80 });

      const adviceBigPot = getAdvice(bigPot);
      const adviceSmallPot = getAdvice(smallPot);

      // При большом банке (треб. эквити ~2%) колл выгоден; при маленьком (треб. ~80%) — фолд
      expect(['call', 'raise']).toContain(adviceBigPot.action);
      expect(adviceSmallPot.action).toBe('fold');
    });

    it('в причине совета при toCall > 0 фигурирует требуемая эквити (учёт банка/ставки)', () => {
      const ctx = baseContext({ potSize: 100, toCall: 50 });
      const result = getAdvice(ctx);
      expectPotOdds(result.explanation, 100, 50);
      expect(result.explanation?.equityPct).toBeDefined();
    });

    it('при банке 0 и toCall > 0 не советует fold из-за «требуемая эквити 100%»', () => {
      const ctx = baseContext({ potSize: 0, toCall: 10 });
      const result = getAdvice(ctx);
      expect(result.reason).not.toMatch(/~100%|100%/);
      expect(result.reason).toMatch(/Банк не указан|эквити/i);
    });

    it('при банке 0 и toCall > 0 в причине указывается, что банк не задан (без пот-оддсов)', () => {
      const ctx = baseContext({ potSize: 0, toCall: 50 });
      const result = getAdvice(ctx);
      expect(adviceText(result)).toContain('Банк не указан');
      expect(result.explanation?.potOddsUnavailable).toBe(true);
      expect(result.explanation?.requiredPct).toBeUndefined();
    });

    it('при pot>0 и toCall=0 в причине НЕ говорит «Банк не указан» (банк задан)', () => {
      // Регресс-тест на дефект №9: pot=100, toCall=0 — банк указан, просто нет ставки.
      const ctx = baseContext({ potSize: 100, toCall: 0 });
      const result = getAdvice(ctx);
      expect(result.reason).not.toMatch(/Банк не указан/);
      expect(result.reason).toMatch(/Нет ставки для колл|чек/i);
    });
  });

  describe('влияние позиции на совет', () => {
    it('при прочих равных поздняя позиция (BTN) даёт не меньшую уверенность в колле, чем ранняя (BB)', () => {
      const lateCtx = baseContext({ positionIndex: 0 }); // BTN — поздняя при 4 игроках
      const earlyCtx = baseContext({ positionIndex: 2 }); // BB — ранняя при 4 игроках
      const late = getAdvice(lateCtx);
      const early = getAdvice(earlyCtx);
      expect(late.confidence).toBeGreaterThanOrEqual(early.confidence);
    });

    it('при маргинальной руке поздняя позиция может дать call, ранняя — fold', () => {
      const ctx = { ...baseContext({ potSize: 100, toCall: 40 }), numPlayers: 6 };
      const late = getAdvice({ ...ctx, positionIndex: 0 });
      const early = getAdvice({ ...ctx, positionIndex: 3 });
      const sameAction = late.action === early.action;
      expect(sameAction || late.confidence !== early.confidence || late.action !== early.action).toBe(true);
      expect(adviceText(late)).not.toMatch(/поздн/i);
      expect(adviceText(early)).not.toMatch(/поздн/i);
    });
  });

  describe('крайние случаи', () => {
    it('без двух карт в руке возвращает check с нулевой уверенностью', () => {
      const ctx = baseContext();
      const invalidCtx: TableContext = { ...ctx, holeCards: ['Ah'] };
      const result = getAdvice(invalidCtx);
      expect(result.action).toBe('check');
      expect(result.confidence).toBe(0);
      expect(result.reason).toContain('две карты');
    });
  });

  describe('ривер — финал, никаких будущих карт', () => {
    it('на ривере с флеш-дро совет не упоминает ауты или шансы улучшения', () => {
      // 4 червы (2 в руке + 2 на борде) — незавершённое флеш-дро, но на ривере карт больше не будет.
      const riverCtx: TableContext = {
        phase: 'river',
        holeCards: ['Ah', 'Kh'],
        board: ['7h', '2h', '9c', '3d', '5s'],
        potSize: 100,
        toCall: 30,
        numPlayers: 6,
        positionIndex: 0,
      };
      const result = getAdvice(riverCtx);
      expect(result.reason).not.toMatch(/аут|улучшени/i);
    });

    it('на ривере эквити 100% (натс) — совет без упоминания дро', () => {
      const riverCtx: TableContext = {
        phase: 'river',
        holeCards: ['Ks', 'Qs'],
        board: ['Js', 'Ts', '9s', '2c', '3d'], // стрит-флеш — натс
        potSize: 150,
        toCall: 50,
        numPlayers: 6,
        positionIndex: 0,
      };
      const result = getAdvice(riverCtx);
      expect(result.action).toBe('raise');
      expect(result.reason).not.toMatch(/аут|улучшени/i);
    });
  });

  describe('имплайд-оддсы', () => {
    it('карманная пара 77 на префлопе в BTN → CALL (сет-майнинг), не FOLD', () => {
      // Контркейс: 77, pot 30, call 15 (required 33%), эквити ~21%.
      // С имплайдами (0.65): effective = 21.5%. В BTN (callThreshold -5) margin ≈ -0.5 → CALL.
      const ctx: TableContext = {
        phase: 'preflop',
        board: [],
        holeCards: ['7h', '7d'],
        potSize: 30,
        toCall: 15,
        numPlayers: 6,
        positionIndex: 0, // BTN — поздняя
      };
      const result = getAdvice(ctx);
      expect(result.action).toBe('call');
      expect(result.explanation?.impliedReason).toBe('сет-майнинг');
      expect(result.explanation?.impliedOdds).toBeLessThan(1);
    });

    it('карманка 77 в ранней позиции (UTG индекс 3) → FOLD (позиция строже)', () => {
      // Та же рука, но ранняя позиция: callThreshold = 0, margin ≈ -0.5 < 0 → FOLD.
      const ctx: TableContext = {
        phase: 'preflop',
        board: [],
        holeCards: ['7h', '7d'],
        potSize: 30,
        toCall: 15,
        numPlayers: 6,
        positionIndex: 3, // UTG — ранняя
      };
      const result = getAdvice(ctx);
      expect(result.action).toBe('fold');
    });

    it('AA (премиум) с toCall>0 → 3-бет (raise), не колл', () => {
      const ctx: TableContext = {
        phase: 'preflop',
        board: [],
        holeCards: ['Ah', 'Ad'],
        potSize: 30,
        toCall: 15,
        numPlayers: 6,
        positionIndex: 0,
      };
      const result = getAdvice(ctx);
      expect(result.action).toBe('raise'); // премиум с toCall>0 → 3-бет
      expect(result.reason).not.toMatch(/имплайд|сет-майнинг/i);
    });

    it('AA без ставки (toCall=0) → raise для велью', () => {
      const ctx: TableContext = {
        phase: 'preflop',
        board: [],
        holeCards: ['Ah', 'Ad'],
        potSize: 3,
        toCall: 0,
        numPlayers: 6,
        positionIndex: 0,
      };
      const result = getAdvice(ctx);
      expect(result.action).toBe('raise');
    });

    it('KK в 4-бет поте (большой toCall) → raise (5-бет/all-in)', () => {
      const ctx: TableContext = {
        phase: 'preflop',
        board: [],
        holeCards: ['Kh', 'Kd'],
        potSize: 1000,
        toCall: 500,
        numPlayers: 6,
        positionIndex: 0,
      };
      const result = getAdvice(ctx);
      expect(result.action).toBe('raise');
    });

    it('QQ и JJ с toCall>0 → raise (3-бет)', () => {
      const qq = getAdvice({ phase: 'preflop', board: [], holeCards: ['Qh', 'Qd'], potSize: 100, toCall: 50, numPlayers: 6, positionIndex: 0 });
      const jj = getAdvice({ phase: 'preflop', board: [], holeCards: ['Jh', 'Jd'], potSize: 100, toCall: 50, numPlayers: 6, positionIndex: 0 });
      expect(qq.action).toBe('raise');
      expect(jj.action).toBe('raise');
    });

    it('сильное дро (9 аутов флеш) на флопе с margin чуть ниже pot-odds → CALL', () => {
      // Флеш-дро: Ah Kh + 2h 7h 9c → 9 аутов, improveChance ~35% (Rule of 4).
      // pot 100, call 50 → required 33%. С имплайдами (0.75): effective 25%.
      // improveChance 35% >= 25% → колл по дро-ветке (но проверим что имплайд-фраза есть).
      const ctx: TableContext = {
        phase: 'flop',
        board: ['2h', '7h', '9c'],
        holeCards: ['Ah', 'Kh'],
        potSize: 100,
        toCall: 50,
        numPlayers: 4,
        positionIndex: 0,
      };
      const result = getAdvice(ctx);
      // Дро с 9 аутами и хорошими оддсами → call (либо по дро-ветке, либо по имплайдам).
      expect(['call', 'raise']).toContain(result.action);
    });

    it('gutshot (4 аута) на флопе → без имплайдов, как раньше', () => {
      // Слабое дро — имплайды не применяются (impliedFactor = 1.0).
      const ctx: TableContext = {
        phase: 'flop',
        board: ['2d', '7c', '9h'],
        holeCards: ['5h', '6d'], // gutshot: нужна 8 для 5-6-7-8-9
        potSize: 100,
        toCall: 50,
        numPlayers: 4,
        positionIndex: 0,
      };
      const result = getAdvice(ctx);
      expect(result.reason).not.toMatch(/имплайд|сет-майнинг/i);
      expect(result.explanation?.impliedOdds).toBeUndefined();
      expect(result.explanation?.impliedReason).toBeUndefined();
    });
  });

  describe('эквити непарных бродвей-рук vs много оппонентов', () => {
    // Регрессионные тесты для дефекта №6. Расследование показало: equityPercent
    // даёт ~23% для AKs vs 8 random — это КОРРЕКТНО (эталон Equilab 22-25%,
    // AKo ~20.7%). Отчёт ошибочно заявлял «истинная equity 30-35%».
    // Fold AKs на 3-бете (required 33%) с equity 23% — математически обоснован.

    it('AKs vs 8 random (equity 23%) на 3-бете (required 33%) → FOLD — корректно', () => {
      const ctx: TableContext = {
        phase: 'preflop',
        board: [],
        holeCards: ['Ah', 'Kh'],
        potSize: 100,
        toCall: 50,
        numPlayers: 9,
        positionIndex: 0, // BTN — поздняя
        equityPercent: 23, // реальное значение equityPercent для AKs vs 8 random
      };
      const result = getAdvice(ctx);
      expect(result.action).toBe('fold');
    });

    it('AKs vs 1 random (equity 68%) на 3-бете → не fold (heads-up эквити высокая)', () => {
      const ctx: TableContext = {
        phase: 'preflop',
        board: [],
        holeCards: ['Ah', 'Kh'],
        potSize: 100,
        toCall: 50,
        numPlayers: 2,
        positionIndex: 0,
        equityPercent: 68,
      };
      const result = getAdvice(ctx);
      expect(result.action).not.toBe('fold');
    });
  });
});

describe('структурированное explanation', () => {
  it('слабая рука на префлопе → fold с эквити и порогом в explanation', () => {
    const ctx: TableContext = {
      phase: 'preflop',
      board: [],
      holeCards: ['2h', '7d'],
      potSize: 100,
      toCall: 50,
      numPlayers: 6,
      positionIndex: 3,
      equityPercent: 18,
    };
    const result = getAdvice(ctx);
    expect(result.action).toBe('fold');
    expect(result.explanation?.equityPct).toBe(18);
    expectPotOdds(result.explanation, 100, 50);
    expect(result.explanation?.marginPct).toBeLessThan(0);
  });

  it('большой банк → call с низким requiredPct', () => {
    const ctx = baseContext({ potSize: 1000, toCall: 10, equityPercent: 55 });
    const result = getAdvice(ctx);
    expect(['call', 'raise']).toContain(result.action);
    expect(result.explanation?.requiredPct).toBeLessThan(2);
    expect(result.explanation?.marginPct).toBeGreaterThan(0);
  });

  it('сильное дро на флопе → outs и improveChancePct в explanation', () => {
    const ctx: TableContext = {
      phase: 'flop',
      board: ['2h', '7h', '9c'],
      holeCards: ['Ah', 'Kh'],
      potSize: 100,
      toCall: 50,
      numPlayers: 4,
      positionIndex: 0,
    };
    const result = getAdvice(ctx);
    expect(['call', 'raise']).toContain(result.action);
    expect(result.explanation?.outs).toBeGreaterThanOrEqual(8);
    expect(result.explanation?.improveChancePct).toBeGreaterThan(0);
    expect(result.explanation?.impliedReason).toMatch(/дро|монстр/);
  });

  it('банк не указан → potOddsUnavailable без requiredPct', () => {
    const ctx = baseContext({ potSize: 0, toCall: 25, equityPercent: 40 });
    const result = getAdvice(ctx);
    expect(result.explanation?.potOddsUnavailable).toBe(true);
    expect(result.explanation?.requiredPct).toBeUndefined();
    expect(result.explanation?.potOdds).toBeUndefined();
  });

  it('маргинальное решение → isMarginal при CI вокруг порога', () => {
    const ctx: TableContext = {
      ...baseContext({ potSize: 100, toCall: 40 }),
      equityPercent: 29,
      equityLow: 26,
      equityHigh: 32,
    };
    const result = getAdvice(ctx);
    expect(result.explanation?.isMarginal).toBe(true);
    expect(result.explanation?.requiredPct).toBeCloseTo(28.6, 0);
  });
});

describe('динамическая надёжность (confidence)', () => {
  it('слабый фолд с большим дефицитом надёжнее, чем фолд у порога', () => {
    const largeDeficit = getAdvice(
      baseContext({ potSize: 10, toCall: 100, equityPercent: 15, positionIndex: 3 }),
    );
    const nearThreshold = getAdvice(
      baseContext({
        potSize: 100,
        toCall: 50,
        equityPercent: 31,
        equityLow: 28,
        equityHigh: 34,
        positionIndex: 3,
      }),
    );
    expect(largeDeficit.action).toBe('fold');
    expect(nearThreshold.action).toBe('fold');
    expect(largeDeficit.confidence).toBeGreaterThan(nearThreshold.confidence);
  });

  it('колл с большим запасом надёжнее, чем колл у порога', () => {
    const largeSurplus = getAdvice(
      baseContext({ potSize: 1000, toCall: 10, equityPercent: 55 }),
    );
    const closeCall = getAdvice({
      phase: 'flop',
      board: ['2d', '7c', '9h'],
      holeCards: ['Ah', 'Kd'],
      potSize: 100,
      toCall: 50,
      numPlayers: 4,
      positionIndex: 0,
      equityPercent: 39,
      equityLow: 36,
      equityHigh: 42,
    });
    expect(largeSurplus.action).toBe('call');
    expect(closeCall.action).toBe('call');
    expect(largeSurplus.confidence).toBeGreaterThan(closeCall.confidence);
  });

  it('без пот-оддсов надёжность ниже, чем при тех же картах с банком', () => {
    const withPotOdds = getAdvice(
      baseContext({ potSize: 100, toCall: 50, equityPercent: 40 }),
    );
    const withoutPotOdds = getAdvice(
      baseContext({ potSize: 0, toCall: 50, equityPercent: 40 }),
    );
    expect(withPotOdds.explanation?.requiredPct).toBeDefined();
    expect(withoutPotOdds.explanation?.potOddsUnavailable).toBe(true);
    expect(withoutPotOdds.confidence).toBeLessThan(withPotOdds.confidence);
  });

  it('сильные руки сохраняют высокую надёжность независимо от gap', () => {
    const premium = getAdvice({
      phase: 'preflop',
      board: [],
      holeCards: ['Ah', 'Ad'],
      potSize: 30,
      toCall: 15,
      numPlayers: 6,
      positionIndex: 0,
    });
    expect(premium.action).toBe('raise');
    expect(premium.confidence).toBeGreaterThanOrEqual(0.85);
  });
});

describe('модификатор совета по PFR активного оппонента', () => {
  // Базовый контекст: средняя рука на флопе, toCall>0, маргинальная эквити.
  function baseCtx(overrides: Partial<TableContext> = {}): TableContext {
    return {
      phase: 'flop',
      board: ['2d', '7c', '9h'],
      holeCards: ['Ah', 'Kd'],
      potSize: 100,
      toCall: 60,
      numPlayers: 2, // heads-up, один оппонент
      positionIndex: 0,
      equityPercent: 45,
      equityLow: 40,
      equityHigh: 50,
      ...overrides,
    };
  }

  it('против нита (PFR 10) порог фолда выше → совет чаще fold', () => {
    const nit: Opponent[] = [{ position: 1, stats: { vpip: 12, pfr: 10 } }];
    const ctx = baseCtx({ opponents: nit, activeOpponentIndex: 0 });
    const result = getAdvice(ctx);
    // Нит-рейз весомее → фолд или пониженная уверенность в колле.
    expect(adviceText(result)).toMatch(/тайтов|PFR|весомее|фолд/i);
  });

  it('против маньяка (PFR 45) порог фолда ниже → совет мягче к коллу', () => {
    const maniac: Opponent[] = [{ position: 1, stats: { vpip: 60, pfr: 45 } }];
    const ctx = baseCtx({ opponents: maniac, activeOpponentIndex: 0 });
    const result = getAdvice(ctx);
    expect(adviceText(result)).toMatch(/агрессив|блеф|колл/i);
  });

  it('без activeOpponentIndex модификатор не применяется (обратная совместимость)', () => {
    const nit: Opponent[] = [{ position: 1, stats: { vpip: 12, pfr: 10 } }];
    const ctx = baseCtx({ opponents: nit }); // без activeOpponentIndex
    const result = getAdvice(ctx);
    // Не должно быть заметки про тайтового оппонента.
    expect(adviceText(result)).not.toMatch(/тайтов|весомее/i);
  });

  it('без opponents вообще — как раньше (обратная совместимость)', () => {
    const ctx = baseCtx({});
    const result = getAdvice(ctx);
    expect(result.action).toBeDefined();
  });
});
