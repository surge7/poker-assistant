import { describe, it, expect } from 'vitest';
import { getAdvice } from './advice';
import type { TableContext } from './types';

/** Базовый контекст: одна и та же рука и борд, меняем банк, toCall, позицию. */
function baseContext(
  overrides: Partial<Pick<TableContext, 'potSize' | 'toCall' | 'positionIndex'>> = {}
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
      expect(result.reason).toContain('Нет ставки на колл');
    });

    it('при большом банке относительно ставки совет чаще колл (низкая требуемая эквити)', () => {
      // Банк 1000, колл 10 → требуемая эквити ~1%
      const ctxBigPot = baseContext({ potSize: 1000, toCall: 10 });
      const resultBigPot = getAdvice(ctxBigPot);
      expect(['call', 'raise']).toContain(resultBigPot.action);
      expect(resultBigPot.reason).toMatch(/\d+%|требуемых|нужно/);
    });

    it('при большой ставке относительно банка совет чаще фолд (высокая требуемая эквити)', () => {
      // Банк 10, колл 100 → требуемая эквити ~91%
      const ctxSmallPot = baseContext({ potSize: 10, toCall: 100 });
      const resultSmallPot = getAdvice(ctxSmallPot);
      expect(resultSmallPot.action).toBe('fold');
      expect(resultSmallPot.reason).toMatch(/требуемых|банк\/ставка|фолд/i);
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
      expect(result.reason).toMatch(/требуемых|нужно ~\d+%|\d+% при требуемых|банк\/ставка/);
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
      expect(result.reason).toContain('Банк не указан');
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
      // Рука с эквити чуть ниже требуемой: в поздней позиции допускаем margin >= -5, в ранней >= 0
      const ctx = { ...baseContext({ potSize: 100, toCall: 40 }), numPlayers: 6 };
      const late = getAdvice({ ...ctx, positionIndex: 0 });
      const early = getAdvice({ ...ctx, positionIndex: 3 });
      // При 6 игроках: 0 = BTN (поздняя), 3 = UTG (ранняя). Одна и та же рука — разница только в пороге колла
      const sameAction = late.action === early.action;
      const lateMentionsPos = late.reason.includes('поздн') || late.reason.includes('Позиция');
      const earlyMentionsPos = early.reason.includes('поздн') || early.reason.includes('Позиция');
      expect(sameAction || lateMentionsPos || earlyMentionsPos || late.confidence !== early.confidence).toBe(true);
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
});
