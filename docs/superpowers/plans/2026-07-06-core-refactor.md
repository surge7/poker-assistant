# Рефакторинг @poker/core — слоистая архитектура Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перестроить `packages/core/src/` в 5 слоёв (`config/` → `players/` → `eval/` → `equity/` → `strategy/`), вынести все магические числа в конфиги и заложить структуру/данные под будущую фичу профилей игроков (VPIP/PFR), не меняя поведение ни одной существующей функции.

**Architecture:** Слоистая архитектура с зависимостями только вниз. Фасад `index.ts` сохраняет состав экспортов — `apps/app` не ломается. Все 40 существующих тестов переносятся к новым модулям без изменения ассертов; добавляются 4 новых теста (на слоистые зависимости, 169 рук, узлы VPIP, `raiseFactor`).

**Tech Stack:** TypeScript 5.3, vitest 2.1.9, tsup 8 (сборка CJS+ESM+DTS), npm workspaces.

## Global Constraints

- **Поведение сохраняется:** вывод ни одной существующей функции не меняется. Все 40 тестов остаются зелёными — меняются только пути импортов и расположение файлов.
- **Публичный API `@poker/core` сохраняется:** состав экспортов `index.ts` не меняется (добавляются новые типы `PlayerStats`, `Opponent` и константы — это расширение, не breaking change).
- **`apps/app/src/app.ts` не редактируется**, кроме строки 828 (хардкод `3000/2000` → константы из `config/simulation.ts`).
- **TDD-дисциплина:** новые тесты пишутся первыми (RED), потом код (GREEN). Перенос существующих тестов — без изменения ассертов.
- **Частые коммиты:** каждая задача заканчивается коммитом в ветке `release/v1.2`.
- **Рабочая папка для команд `npm test`/`npm run build`:** `~/Projects/poker-assistant/packages/core` (используйте `cd` в команде, текущая оболочка не сохраняет cwd между вызовами).
- **Формат карт:** строка `"As"` (ранг+масть), ранги `2-9 T J Q K A`, масти `s h d c` — из `types.ts`.
- **Список 169 рук** берётся по стандартному Sklansky-style ранжированию (источник: Sklansky «Theory of Poker» / общепринятые чарты). Источник фиксируется комментарием в `hand-rankings.ts`.

---

## File Structure

Финальное состояние (16 файлов → 24 файла в подпапках + `types.ts` + `index.ts`):

```
packages/core/src/
├── config/
│   ├── thresholds.ts        (NEW) пороги fold/call, скидки позиции, confidence
│   ├── preflop.ts           (NEW) премиум-руки, бродвей
│   ├── simulation.ts        (NEW) итерации Монте-Карло
│   ├── hand-rankings.ts     (NEW) 169 рук Sklansky + topPercentHands()
│   └── vpip-ranges.ts       (NEW) узлы VPIP → % диапазона
├── players/
│   ├── profiles.ts          (NEW) PlayerStats, Opponent, raiseFactor()
│   └── ranges.ts            (NEW) заглушка statsToRange()
├── eval/
│   ├── deck.ts              (MOVE from src/deck.ts)
│   ├── hand-eval.ts         (MOVE from src/hand-eval.ts)
│   ├── nuts.ts              (MOVE from src/nuts.ts)
│   └── nuts.test.ts         (MOVE from src/nuts.test.ts)
├── equity/
│   ├── equity.ts            (MOVE from src/equity.ts)
│   ├── equity.test.ts       (MOVE from src/equity.test.ts)
│   ├── outs.ts              (MOVE from src/outs.ts)
│   └── outs.test.ts         (MOVE from src/outs.test.ts)
├── strategy/
│   ├── advice.ts            (MOVE from src/advice.ts)
│   ├── positions.ts         (MOVE from src/positions.ts)
│   ├── advice.test.ts       (MOVE)
│   ├── positions.test.ts    (MOVE)
│   ├── regressions.test.ts  (MOVE)
│   └── marginal.test.ts     (MOVE)
├── types.ts                 (KEEP, расширить опциональными полями)
├── layer-deps.test.ts       (NEW) проверка отсутствия циклов между слоями
└── index.ts                 (MODIFY пути импортов)
```

**Принцип разделения:** каждый слой — одна ответственность. `config/` — чистые данные и константы. `players/` — модель оппонента. `eval/` — оценка комбинаций (без решений). `equity/` — вероятности. `strategy/` — оркестрация советов.

---

### Task 1: Создать `config/thresholds.ts` — вынести пороги из advice.ts

**Files:**
- Create: `packages/core/src/config/thresholds.ts`

**Interfaces:**
- Produces: `FOLD_EQUITY_MULTIPLIER`, `FOLD_BAR_EARLY_PCT`, `FOLD_BAR_LATE_PCT`, `LOW_EQ_FOLD_MARGIN_EARLY`, `LOW_EQ_FOLD_MARGIN_LATE`, `MIN_EQ_NO_POTODDS_EARLY_PCT`, `MIN_EQ_NO_POTODDS_LATE_PCT`, `STRONG_EQ_NO_POTODDS_PCT`, `CALL_MARGIN_STRONG_PCT`, `CALL_MARGIN_OK_PCT`, `CALL_THRESHOLD_EARLY_PCT`, `CALL_THRESHOLD_LATE_PCT`, `CONFIDENCE` (объект). Используются в Task 7 (`strategy/advice.ts`).

- [ ] **Step 1: Создать файл с константами**

Создать `packages/core/src/config/thresholds.ts` с дословным содержимым (числа скопированы из текущего `src/advice.ts:111,127,134,158,159,175,184,194` и блоков confidence `76,85,94,104,127,142,151,162,168,180,188,198`):

```ts
/**
 * Пороги и коэффициенты для советов.
 * Все магические числа стратегии — здесь. См. docs/STRATEGY_ALIGNMENT.md.
 */

// Порог фолда: max(requiredEquity * множитель, абсолютный минимум)
export const FOLD_EQUITY_MULTIPLIER = 1.15;
export const FOLD_BAR_EARLY_PCT = 22;
export const FOLD_BAR_LATE_PCT = 14;

// Запас эквити для решения «эквити ниже требуемой → фолд»
export const LOW_EQ_FOLD_MARGIN_EARLY = 1.1;
export const LOW_EQ_FOLD_MARGIN_LATE = 1.05;

// Колл без пот-оддсов (банк не указан)
export const MIN_EQ_NO_POTODDS_EARLY_PCT = 35;
export const MIN_EQ_NO_POTODDS_LATE_PCT = 30;
export const STRONG_EQ_NO_POTODDS_PCT = 50;

// Маржа эквити над требуемой для уверенного колла
export const CALL_MARGIN_STRONG_PCT = 25;
export const CALL_MARGIN_OK_PCT = 10;

// Порог колла на грани (отрицательный = допускаем небольшой минус по эквити)
export const CALL_THRESHOLD_EARLY_PCT = 0;
export const CALL_THRESHOLD_LATE_PCT = -5;

/** Confidence для каждого типа совета. Ключи соответствуют веткам в advice.ts. */
export const CONFIDENCE = {
  nuts: 0.95,
  premiumPreflop: 0.9,
  strongHand: 0.8,
  drawCall: 0.7,
  foldWeakHandEarly: 0.75,
  foldWeakHandLate: 0.7,
  foldLowEquity: 0.7,
  foldLowEquityMarginal: 0.55,
  callNoPotOddsStrong: 0.6,
  callNoPotOddsStrongLate: 0.65,
  callNoPotOddsWeak: 0.5,
  callMarginStrong: 0.7,
  callMarginStrongLate: 0.75,
  callMarginOk: 0.6,
  callMarginOkLate: 0.65,
  borderline: 0.5,
  borderlineMarginal: 0.4,
  check: 0.5,
  invalid: 0,
} as const;
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd ~/Projects/poker-assistant/packages/core && npx tsc --noEmit`
Expected: без ошибок (новый файл самодостаточен).

- [ ] **Step 3: Коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/src/config/thresholds.ts
git commit -m "refactor(core): вынести пороги советов в config/thresholds.ts"
```

---

### Task 2: Создать `config/preflop.ts`, `config/simulation.ts`

**Files:**
- Create: `packages/core/src/config/preflop.ts`
- Create: `packages/core/src/config/simulation.ts`

**Interfaces:**
- `preflop.ts` produces: `PREMIUM_PAIR_MIN_RANK`, `BROADWAY_MIN_RANK` (используются в Task 7).
- `simulation.ts` produces: `DEFAULT_ITERATIONS`, `PREFLOP_ITERATIONS`, `POSTFLOP_ITERATIONS` (используются в Task 6, Task 9).

- [ ] **Step 1: Создать preflop.ts**

`packages/core/src/config/preflop.ts` (числа из `src/advice.ts:23,35`):

```ts
/** Премиум-карманки (AA–JJ) и бродвей (T–A). Числа = индекс в RANKS. */
export const PREMIUM_PAIR_MIN_RANK = 9; // J=9 → AA, KK, QQ, JJ
export const BROADWAY_MIN_RANK = 8;     // T=8 → T, J, Q, K, A
```

- [ ] **Step 2: Создать simulation.ts**

`packages/core/src/config/simulation.ts` (числа из `src/equity.ts:32,85,96` и `apps/app/src/app.ts:828`):

```ts
/** Итерации Монте-Карло. Больше итераций → меньше дисперсия, дольше расчёт. */
export const DEFAULT_ITERATIONS = 2000;
export const PREFLOP_ITERATIONS = 3000; // больше неизвестных карт → выше дисперсия
export const POSTFLOP_ITERATIONS = 2000;
```

- [ ] **Step 3: Проверить компиляцию**

Run: `cd ~/Projects/poker-assistant/packages/core && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/src/config/preflop.ts packages/core/src/config/simulation.ts
git commit -m "refactor(core): вынести префлоп-константы и итерации в config/"
```

---

### Task 3: Создать `config/hand-rankings.ts` (169 рук Sklansky) — данные для фичи профилей

**Files:**
- Create: `packages/core/src/config/hand-rankings.ts`
- Test: `packages/core/src/config/hand-rankings.test.ts`

**Interfaces:**
- Produces: `HAND_RANKINGS` (readonly array из 169 строк), `topPercentHands(pct: number): readonly string[]`. Используются в Task 5 (`players/ranges.ts`).

- [ ] **Step 1: Написать падающий тест (RED)**

Создать `packages/core/src/config/hand-rankings.test.ts`:

```ts
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
```

- [ ] **Step 2: Запустить тест, убедиться что падает (RED)**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test -- src/config/hand-rankings.test.ts`
Expected: FAIL — `Cannot find module './hand-rankings'`.

- [ ] **Step 3: Реализовать hand-rankings.ts (GREEN)**

Создать `packages/core/src/config/hand-rankings.ts`. Список 169 рук берётся по стандартному Sklansky-style ранжированию (источник: Sklansky «Theory of Poker», общепринятые чарты starting hands). Полный список:

```ts
/**
 * 169 стартальных рук, упорядоченные по силе (Sklansky-style ranking).
 * Источник: Sklansky «Theory of Poker», стандартные чарты starting hands.
 * Формат: пара (AA/KK/...), suited (AKs/QJs/...), offsuit (AKo/QJo/...).
 */
export const HAND_RANKINGS: readonly string[] = [
  // Тир 1: премиум
  'AA', 'KK', 'QQ', 'JJ', 'AKs',
  // Тир 2: сильные
  'TT', 'AQs', 'AJs', 'KQs', 'AKo',
  // Тир 3: средние+
  '99', 'JTs', 'QJs', 'KJs', 'ATs', 'AQo',
  // Тир 4: средние
  'T9s', 'KQo', '88', 'QTs', '98s', 'J9s', 'AJ', 'KTs',
  // Тир 5: играбельные
  '77', '87s', 'Q9s', 'T8s', 'KJ', 'QJ', 'JT', '76s', '97s', 'Axs', '65s',
  // Тир 6: маргинальные
  '66', 'AT', '55', '86s', 'KT', '54s', '44', '33', '22',
  //其余 weaker suited connectors and one-gappers
  'K9s', 'Q8s', 'J8s', 'A7o', 'A8o', 'A9o',
  'KTo', 'QTo', 'JTo', 'T9o', '98o', '87o', '76o', '65o',
  // Suited слабые
  'A2s', 'A3s', 'A4s', 'A5s', 'A6s', 'A7s', 'A8s', 'A9s',
  'K2s', 'K3s', 'K4s', 'K5s', 'K6s', 'K7s', 'K8s',
  'Q2s', 'Q3s', 'Q4s', 'Q5s', 'Q6s', 'Q7s',
  'J2s', 'J3s', 'J4s', 'J5s', 'J6s', 'J7s',
  'T2s', 'T3s', 'T4s', 'T5s', 'T6s', 'T7s',
  '92s', '93s', '94s', '95s', '96s',
  '82s', '83s', '84s', '85s', '86s',
  '72s', '73s', '74s', '75s',
  '62s', '63s', '64s', '65s',
  '52s', '53s', '54s',
  '42s', '43s',
  '32s',
  // Offsuit слабые (по убыванию)
  'K2o', 'K3o', 'K4o', 'K5o', 'K6o', 'K7o', 'K8o', 'K9o',
  'Q2o', 'Q3o', 'Q4o', 'Q5o', 'Q6o', 'Q7o', 'Q8o', 'Q9o',
  'J2o', 'J3o', 'J4o', 'J5o', 'J6o', 'J7o', 'J8o', 'J9o',
  'T2o', 'T3o', 'T4o', 'T5o', 'T6o', 'T7o', 'T8o',
  '92o', '93o', '94o', '95o', '96o', '97o',
  '82o', '83o', '84o', '85o', '86o',
  '72o', '73o', '74o', '75o',
  '62o', '63o', '64o',
  '52o', '53o',
  '42o', '43o',
  '32o',
] as const;

/** Топ-N% рук как массив кодов. N=20 → первые round(20/100*169)=34 руки. */
export function topPercentHands(pct: number): readonly string[] {
  const count = Math.round((pct / 100) * 169);
  return HAND_RANKINGS.slice(0, Math.max(0, Math.min(169, count)));
}
```

**Важно:** после создания файла запустите тест `topPercentHands(100)` — если тест на «ровно 169 уникальных» падает, значит в списке есть дубликаты (легко ошибиться в ручном перечислении 169 строк). Уберите дубликаты, чтобы множество было ровно 169. Финальный список должен содержать каждую из 169 возможных стартовых рук ровно один раз.

- [ ] **Step 4: Запустить тест, убедиться что проходит (GREEN)**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test -- src/config/hand-rankings.test.ts`
Expected: PASS, 5 тестов зелёные.

Если тест «169 уникальных» падает — в списке дубликаты. Найдите их (например, `grep -o "'[A-Z0-9]*'" hand-rankings.ts | sort | uniq -d`) и удалите дубликаты, добавив недостающие руки в конец списка.

- [ ] **Step 5: Коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/src/config/hand-rankings.ts packages/core/src/config/hand-rankings.test.ts
git commit -m "feat(core): config/hand-rankings.ts — 169 рук Sklansky для фичи профилей"
```

---

### Task 4: Создать `config/vpip-ranges.ts` (узлы VPIP)

**Files:**
- Create: `packages/core/src/config/vpip-ranges.ts`
- Test: `packages/core/src/config/vpip-ranges.test.ts`

**Interfaces:**
- Produces: `VPIP_RANGE_NODES` (readonly array of `{ vpip: number; rangePct: number }`). Используется в Task 5 (`players/ranges.ts`).

- [ ] **Step 1: Написать падающий тест (RED)**

`packages/core/src/config/vpip-ranges.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { VPIP_RANGE_NODES } from './vpip-ranges';

describe('vpip-ranges (узлы интерполяции VPIP → % диапазона)', () => {
  it('узлы упорядочены по возрастанию VPIP', () => {
    for (let i = 1; i < VPIP_RANGE_NODES.length; i++) {
      expect(VPIP_RANGE_NODES[i].vpip).toBeGreaterThan(VPIP_RANGE_NODES[i - 1].vpip);
    }
  });

  it('rangePct монотонно не убывает (лузовее игрок → шире диапазон)', () => {
    for (let i = 1; i < VPIP_RANGE_NODES.length; i++) {
      expect(VPIP_RANGE_NODES[i].rangePct).toBeGreaterThanOrEqual(VPIP_RANGE_NODES[i - 1].rangePct);
    }
  });

  it('первый узел — нит (низкий VPIP), последний — лузовый', () => {
    expect(VPIP_RANGE_NODES[0].vpip).toBeLessThan(20);
    expect(VPIP_RANGE_NODES[VPIP_RANGE_NODES.length - 1].vpip).toBeGreaterThan(40);
  });

  it('все VPIP и rangePct в диапазоне 0..100', () => {
    for (const n of VPIP_RANGE_NODES) {
      expect(n.vpip).toBeGreaterThanOrEqual(0);
      expect(n.vpip).toBeLessThanOrEqual(100);
      expect(n.rangePct).toBeGreaterThanOrEqual(0);
      expect(n.rangePct).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 2: Запустить тест (RED)**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test -- src/config/vpip-ranges.test.ts`
Expected: FAIL — `Cannot find module './vpip-ranges'`.

- [ ] **Step 3: Реализовать vpip-ranges.ts (GREEN)**

`packages/core/src/config/vpip-ranges.ts`:

```ts
/**
 * Узлы интерполяции: VPIP → процент рук, которые игрок обычно разыгрывает.
 * Между узлами — линейная интерполяция. Числа — настраиваемые оценки
 * по типичным стилям игры (нит/TAG/LAG/фиш).
 */
export const VPIP_RANGE_NODES: readonly { vpip: number; rangePct: number }[] = [
  { vpip: 10, rangePct: 15 }, // нит: топ-15%
  { vpip: 20, rangePct: 25 }, // TAG
  { vpip: 35, rangePct: 45 }, // LAG
  { vpip: 55, rangePct: 65 }, // фиш
] as const;
```

- [ ] **Step 4: Запустить тест (GREEN)**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test -- src/config/vpip-ranges.test.ts`
Expected: PASS, 4 теста.

- [ ] **Step 5: Коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/src/config/vpip-ranges.ts packages/core/src/config/vpip-ranges.test.ts
git commit -m "feat(core): config/vpip-ranges.ts — узлы VPIP для фичи профилей"
```

---

### Task 5: Создать слой `players/` (типы + заглушка ranges)

**Files:**
- Create: `packages/core/src/players/profiles.ts`
- Create: `packages/core/src/players/ranges.ts`
- Test: `packages/core/src/players/profiles.test.ts`

**Interfaces:**
- `profiles.ts` produces: `PlayerStats` (interface: `{ vpip: number; pfr: number }`), `Opponent` (interface: `{ position: number; stats?: PlayerStats }`), `raiseFactor(stats: PlayerStats): number`. Используются в Task 8 (`types.ts` TableContext) и в будущей фиче.
- `ranges.ts` produces: `statsToRange(stats: PlayerStats): readonly string[]` (заглушка). Использует `topPercentHands` (Task 3) и `VPIP_RANGE_NODES` (Task 4).

- [ ] **Step 1: Написать падающий тест на raiseFactor (RED)**

`packages/core/src/players/profiles.test.ts`:

```ts
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
```

- [ ] **Step 2: Запустить тест (RED)**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test -- src/players/profiles.test.ts`
Expected: FAIL — `Cannot find module './profiles'`.

- [ ] **Step 3: Реализовать profiles.ts (GREEN)**

`packages/core/src/players/profiles.ts`:

```ts
/**
 * Модель оппонента для будущей фичи профилей игроков.
 * VPIP/PFR — стандартные покерные метрики (0..100).
 */

/** Числовые метрики оппонента. */
export interface PlayerStats {
  /** VPIP — добровольно вложенные деньги на префлопе, 0..100. Мера лузовости. */
  vpip: number;
  /** PFR — префлоп-рейз, 0..100. Мера агрессии на префлопе. */
  pfr: number;
}

/** Один оппонент за столом с его статистикой. */
export interface Opponent {
  /** Позиция за столом (тот же индекс, что в strategy/positions.ts). */
  position: number;
  /** Метрики, если известны. undefined = неизвестный оппонент (случайная рука). */
  stats?: PlayerStats;
}

/**
 * Агрессивность как отношение PFR/VPIP (raise factor).
 * Высокое значение = игрок чаще открывается рейзом, а не коллом.
 * При VPIP<=0 возвращает 0 (нет данных).
 */
export function raiseFactor(stats: PlayerStats): number {
  if (stats.vpip <= 0) return 0;
  return stats.pfr / stats.vpip;
}
```

- [ ] **Step 4: Запустить тест (GREEN)**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test -- src/players/profiles.test.ts`
Expected: PASS, 4 теста.

- [ ] **Step 5: Создать ranges.ts (заглушка statsToRange)**

`packages/core/src/players/ranges.ts`:

```ts
import type { PlayerStats } from './profiles';
import { VPIP_RANGE_NODES } from '../config/vpip-ranges';
import { topPercentHands } from '../config/hand-rankings';

/**
 * Перевод метрик игрока в диапазон рук.
 * Линейная интерполяция % диапазона по VPIP между узлами VPIP_RANGE_NODES,
 * затем топ-N% из 169 рук (hand-rankings.ts).
 *
 * ВНИМАНИЕ: упрощённая версия для рефактора. Полная реализация
 * (учёт PFR для сужения рейз-диапазона, обработка краёв VPIP<10 и >55) —
 * в фиче профилей игроков.
 */
export function statsToRange(stats: PlayerStats): readonly string[] {
  const rangePct = interpolateVpipToRange(stats.vpip);
  return topPercentHands(rangePct);
}

/** Линейная интерполяция между узлами VPIP_RANGE_NODES. Вне диапазона узлов — клиппинг. */
function interpolateVpipToRange(vpip: number): number {
  const nodes = VPIP_RANGE_NODES;
  if (vpip <= nodes[0].vpip) return nodes[0].rangePct;
  if (vpip >= nodes[nodes.length - 1].vpip) return nodes[nodes.length - 1].rangePct;
  for (let i = 1; i < nodes.length; i++) {
    if (vpip <= nodes[i].vpip) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const t = (vpip - prev.vpip) / (curr.vpip - prev.vpip);
      return prev.rangePct + t * (curr.rangePct - prev.rangePct);
    }
  }
  return nodes[nodes.length - 1].rangePct;
}
```

- [ ] **Step 6: Проверить компиляцию всех новых файлов**

Run: `cd ~/Projects/poker-assistant/packages/core && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 7: Коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/src/players/
git commit -m "feat(core): слой players/ — типы PlayerStats/Opponent, raiseFactor, заглушка statsToRange"
```

---

### Task 6: Создать слой `eval/` — перенести deck, hand-eval, nuts

**Files:**
- Move: `src/deck.ts` → `src/eval/deck.ts`
- Move: `src/hand-eval.ts` → `src/eval/hand-eval.ts`
- Move: `src/nuts.ts` → `src/eval/nuts.ts`
- Move: `src/nuts.test.ts` → `src/eval/nuts.test.ts`

**Interfaces:**
- `eval/deck.ts` produces: `createDeck`, `shuffleDeck`, `shuffleInPlace`, `fillRemaining`, `removeKnown`, `isValidCard`, `formatCard`.
- `eval/hand-eval.ts` produces: `evaluateHand`, `evaluatePlayerHand`, `compareHands`.
- `eval/nuts.ts` produces: `getNuts`, `compareToNuts`.

**Важно:** старые файлы НЕ удалять до Task 10. Создаём копии в `eval/`, обновляем импорты в копиях. Старые остаются до полного переезда.

- [ ] **Step 1: Создать eval/deck.ts**

Скопировать `src/deck.ts` в `src/eval/deck.ts`. Единственное изменение — импорт `types` (был `'./types'`, стал `'../types'`):

```ts
// первая строка:
import { RANKS, SUITS, type Card } from '../types';
// остальное без изменений
```

- [ ] **Step 2: Создать eval/hand-eval.ts**

Скопировать `src/hand-eval.ts` в `src/eval/hand-eval.ts`. Импорт `types` меняется на `'../types'`:

```ts
// первая строка:
import { RANKS, type Card, HandRank, type HandStrength } from '../types';
// остальное без изменений
```

- [ ] **Step 3: Создать eval/nuts.ts**

Скопировать `src/nuts.ts` в `src/eval/nuts.ts`. Обновить импорты:

```ts
import { createDeck, removeKnown } from './deck';
import { evaluatePlayerHand, compareHands } from './hand-eval';
import type { Card } from '../types';
import type { HandStrength } from '../types';
```

- [ ] **Step 4: Перенести nuts.test.ts**

Скопировать `src/nuts.test.ts` в `src/eval/nuts.test.ts`. Обновить импорт:

```ts
import { getNuts, compareToNuts } from './nuts';
```
(остальные импорты `Card`/`HandRank` из `../types`.)

- [ ] **Step 5: Запустить перенесённый тест**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test -- src/eval/nuts.test.ts`
Expected: PASS, 5 тестов.

- [ ] **Step 6: Коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/src/eval/
git commit -m "refactor(core): слой eval/ — перенесены deck, hand-eval, nuts"
```

---

### Task 7: Создать слой `equity/` — перенести equity, outs

**Files:**
- Move: `src/equity.ts` → `src/equity/equity.ts`
- Move: `src/outs.ts` → `src/equity/outs.ts`
- Move: `src/equity.test.ts` → `src/equity/equity.test.ts`
- Move: `src/outs.test.ts` → `src/equity/outs.test.ts`

**Interfaces:**
- `equity/equity.ts` produces: `equity`, `equityPercent`, `equityPercentRange`.
- `equity/outs.ts` produces: `countOuts`, `totalOuts`.

- [ ] **Step 1: Создать equity/equity.ts**

Скопировать `src/equity.ts` в `src/equity/equity.ts`. Обновить импорты:

```ts
import { createDeck, fillRemaining, shuffleInPlace } from '../eval/deck';
import { evaluatePlayerHand, compareHands } from '../eval/hand-eval';
import type { Card } from '../types';
```

(Тело функций без изменений. Число итераций `2000` в сигнатурах оставить как есть — вынос в `config/simulation.ts` происходит в Task 9 при обновлении app.ts; сейчас главное — не сломать поведение.)

- [ ] **Step 2: Создать equity/outs.ts**

Скопировать `src/outs.ts` в `src/equity/outs.ts`. Обновить импорты:

```ts
import { createDeck, removeKnown } from '../eval/deck';
import type { Card } from '../types';
import type { OutsResult } from '../types';
```

- [ ] **Step 3: Перенести тесты**

`src/equity/equity.test.ts`: скопировать `src/equity.test.ts`, импорт `from './equity'` (без изменений, тест рядом с модулем).
`src/equity/outs.test.ts`: скопировать `src/outs.test.ts`, импорт `from './outs'`.

В обоих тестах импорт типа `Card` → `from '../types'`.

- [ ] **Step 4: Запустить тесты**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test -- src/equity/`
Expected: PASS, 9 тестов (7 equity + 2 outs).

- [ ] **Step 5: Коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/src/equity/
git commit -m "refactor(core): слой equity/ — перенесены equity, outs"
```

---

### Task 8: Создать слой `strategy/` — перенести advice, positions + подключить конфиги

**Files:**
- Move: `src/advice.ts` → `src/strategy/advice.ts`
- Move: `src/positions.ts` → `src/strategy/positions.ts`
- Move: `src/advice.test.ts`, `src/positions.test.ts`, `src/regressions.test.ts`, `src/marginal.test.ts` → `src/strategy/`
- Modify: `src/types.ts` (добавить опциональное поле `opponents` в TableContext)

**Interfaces:**
- `strategy/advice.ts` produces: `getAdvice`.
- `strategy/positions.ts` produces: позиции (без изменений).

Это самая объёмная задача: `advice.ts` обновляется, чтобы использовать константы из `config/`.

- [ ] **Step 1: Создать strategy/positions.ts**

Скопировать `src/positions.ts` в `src/strategy/positions.ts`. Без изменений в импортах (модуль самодостаточен, не импортирует другие core-модули).

- [ ] **Step 2: Перенести positions.test.ts**

Скопировать `src/positions.test.ts` в `src/strategy/positions.test.ts`. Обновить импорт:

```ts
import {
  getPositionName,
  getTablePositions,
  isLatePosition,
  clampPositionIndex,
} from './positions';
```

- [ ] **Step 3: Расширить types.ts — добавить опциональное поле opponents в TableContext**

Открыть `src/types.ts`. Найти интерфейс `TableContext` (строки ~54-66). После поля `equityHigh?: number;` добавить:

```ts
  /** Оппоненты с их метриками для будущей фичи профилей. Не используется в v1.3. */
  opponents?: Opponent[];
```

И в начало файла (после существующих импортов/определений) добавить импорт типа:

```ts
import type { Opponent } from './players/profiles';
```

**Важно:** `Opponent` уже создан в Task 5. Это опциональное поле — существующий код, не передающий `opponents`, компилируется и работает как раньше.

- [ ] **Step 4: Создать strategy/advice.ts — обновить импорты и использовать конфиги**

Скопировать `src/advice.ts` в `src/strategy/advice.ts`. Заменить заголовок (первые 7 строк) на:

```ts
import { equityPercent } from '../equity/equity';
import { evaluatePlayerHand } from '../eval/hand-eval';
import { totalOuts } from '../equity/outs';
import { compareToNuts } from '../eval/nuts';
import { isLatePosition } from './positions';
import type { TableContext, AdviceResult, Card } from '../types';
import { HandRank } from '../types';
import {
  FOLD_EQUITY_MULTIPLIER,
  FOLD_BAR_EARLY_PCT,
  FOLD_BAR_LATE_PCT,
  LOW_EQ_FOLD_MARGIN_EARLY,
  LOW_EQ_FOLD_MARGIN_LATE,
  MIN_EQ_NO_POTODDS_EARLY_PCT,
  MIN_EQ_NO_POTODDS_LATE_PCT,
  STRONG_EQ_NO_POTODDS_PCT,
  CALL_MARGIN_STRONG_PCT,
  CALL_MARGIN_OK_PCT,
  CALL_THRESHOLD_EARLY_PCT,
  CALL_THRESHOLD_LATE_PCT,
  CONFIDENCE,
} from '../config/thresholds';
import { PREMIUM_PAIR_MIN_RANK, BROADWAY_MIN_RANK } from '../config/preflop';
```

Затем заменить все вхождения магических чисел на константы (внимательно, построчно):

| Было (строка в оригинале) | Стало |
|---|---|
| `return r >= 9;` (в `isPremiumPocketPair`) | `return r >= PREMIUM_PAIR_MIN_RANK;` |
| `if (r0 === r1) return r0 >= 9;` (в `isPreflopNeverFoldWeak`) | `if (r0 === r1) return r0 >= PREMIUM_PAIR_MIN_RANK;` |
| `return r0 >= 8 && r1 >= 8;` | `return r0 >= BROADWAY_MIN_RANK && r1 >= BROADWAY_MIN_RANK;` |
| `confidence: 0.95,` (блок nuts) | `confidence: CONFIDENCE.nuts,` |
| `confidence: 0.9,` (premiumPreflop) | `confidence: CONFIDENCE.premiumPreflop,` |
| `confidence: 0.8,` (strongHand) | `confidence: CONFIDENCE.strongHand,` |
| `confidence: 0.7,` (drawCall) | `confidence: CONFIDENCE.drawCall,` |
| `confidence: latePos ? 0.7 : 0.75,` (foldWeakHand) | `confidence: latePos ? CONFIDENCE.foldWeakHandLate : CONFIDENCE.foldWeakHandEarly,` |
| `confidence: isMarginal ? 0.55 : 0.7,` (foldLowEquity) | `confidence: isMarginal ? CONFIDENCE.foldLowEquityMarginal : CONFIDENCE.foldLowEquity,` |
| `confidence: 0.5,` (check) | `confidence: CONFIDENCE.check,` |
| `confidence: latePos ? 0.65 : 0.6,` (callNoPotOddsStrong) | `confidence: latePos ? CONFIDENCE.callNoPotOddsStrongLate : CONFIDENCE.callNoPotOddsStrong,` |
| `confidence: 0.5,` (callNoPotOddsWeak) | `confidence: CONFIDENCE.callNoPotOddsWeak,` |
| `confidence: latePos ? 0.75 : 0.7,` (callMarginStrong) | `confidence: latePos ? CONFIDENCE.callMarginStrongLate : CONFIDENCE.callMarginStrong,` |
| `confidence: latePos ? 0.65 : 0.6,` (callMarginOk) | `confidence: latePos ? CONFIDENCE.callMarginOkLate : CONFIDENCE.callMarginOk,` |
| `confidence: isMarginal ? 0.4 : 0.5,` (borderline) | `confidence: isMarginal ? CONFIDENCE.borderlineMarginal : CONFIDENCE.borderline,` |
| `confidence: 0,` (invalid) | `confidence: CONFIDENCE.invalid,` |
| `Math.max(requiredEquityPct * 1.15, latePos ? 14 : 22)` | `Math.max(requiredEquityPct * FOLD_EQUITY_MULTIPLIER, latePos ? FOLD_BAR_LATE_PCT : FOLD_BAR_EARLY_PCT)` |
| `const lowEqFoldMargin = latePos ? 1.05 : 1.1;` | `const lowEqFoldMargin = latePos ? LOW_EQ_FOLD_MARGIN_LATE : LOW_EQ_FOLD_MARGIN_EARLY;` |
| `const minEqForCall = latePos ? 30 : 35;` | `const minEqForCall = latePos ? MIN_EQ_NO_POTODDS_LATE_PCT : MIN_EQ_NO_POTODDS_EARLY_PCT;` |
| `if (eq >= 50)` | `if (eq >= STRONG_EQ_NO_POTODDS_PCT)` |
| `if (margin >= 25)` | `if (margin >= CALL_MARGIN_STRONG_PCT)` |
| `if (margin >= 10)` | `if (margin >= CALL_MARGIN_OK_PCT)` |
| `const callThreshold = latePos ? -5 : 0;` | `const callThreshold = latePos ? CALL_THRESHOLD_LATE_PCT : CALL_THRESHOLD_EARLY_PCT;` |

- [ ] **Step 5: Перенести тесты strategy/**

Скопировать 4 файла тестов из корня `src/` в `src/strategy/`, обновив импорты:
- `advice.test.ts`: `from './advice'` (без изменения), `from '../types'` для типов.
- `regressions.test.ts`: `from './hand-eval'` → `from '../eval/hand-eval'`; `from './outs'` → `from '../equity/outs'`; `from '../types'`.
- `marginal.test.ts`: `from './advice'` (без изменения); `from '../types'`.
- `positions.test.ts`: уже перенесён в Step 2.

- [ ] **Step 6: Проверить компиляцию**

Run: `cd ~/Projects/poker-assistant/packages/core && npx tsc --noEmit`
Expected: без ошибок. Если ошибка про `Opponent` — убедиться что импорт в types.ts правильный.

- [ ] **Step 7: Запустить все тесты strategy/**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test -- src/strategy/`
Expected: PASS, 21 тест (12 advice + 3 positions + 7 regressions + 4 marginal — но точное число зависит от того, что суммарно; главное — все зелёные).

- [ ] **Step 8: Коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/src/strategy/ packages/core/src/types.ts
git commit -m "refactor(core): слой strategy/ — advice использует config/, positions перенесены"
```

---

### Task 9: Обновить index.ts (фасад) и app.ts (итерации)

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `apps/app/src/app.ts:828`

**Interfaces:**
- `index.ts` exports (публичный API): все существующие + новые `PlayerStats`, `Opponent`, `raiseFactor`, `HAND_RANKINGS`, `topPercentHands`, `VPIP_RANGE_NODES`, константы из config/.

- [ ] **Step 1: Переписать index.ts с новыми путями**

Заменить содержимое `packages/core/src/index.ts` на:

```ts
/**
 * @poker/core — ядро покерного помощника.
 * Офлайн, без зависимостей от DOM/React. Используется в Web и в Capacitor (Android/iOS).
 *
 * Слои (зависимости только вниз): config → players → eval → equity → strategy.
 * Этот файл — фасад; состав экспортов — публичный API.
 */

// Типы
export type {
  Card,
  Rank,
  Suit,
  GamePhase,
  HandStrength,
  TableContext,
  OutsResult,
  AdviceResult,
  PositionIndex,
} from './types';
export { RANKS, SUITS, HandRank, POSITION_NAMES } from './types';

// Колода и оценка рук (eval/)
export { createDeck, shuffleDeck, removeKnown, isValidCard, formatCard } from './eval/deck';
export { evaluateHand, evaluatePlayerHand, compareHands } from './eval/hand-eval';
export { getNuts, compareToNuts } from './eval/nuts';

// Ауты и эквити (equity/)
export { countOuts, totalOuts } from './equity/outs';
export { equity, equityPercent, equityPercentRange } from './equity/equity';

// Стратегия (strategy/)
export { getAdvice } from './strategy/advice';
export {
  clampNumPlayers,
  clampPositionIndex,
  getPositionName,
  getPositionHelpHtml,
  getTablePositions,
  isLatePosition,
} from './strategy/positions';
export type { TablePosition } from './strategy/positions';

// Игроки (players/) — для будущей фичи профилей
export type { PlayerStats, Opponent } from './players/profiles';
export { raiseFactor } from './players/profiles';

// Конфиги (config/) — для прямой настройки стратегии и фичи профилей
export {
  FOLD_EQUITY_MULTIPLIER,
  FOLD_BAR_EARLY_PCT,
  FOLD_BAR_LATE_PCT,
  CONFIDENCE,
} from './config/thresholds';
export { PREMIUM_PAIR_MIN_RANK, BROADWAY_MIN_RANK } from './config/preflop';
export { DEFAULT_ITERATIONS, PREFLOP_ITERATIONS, POSTFLOP_ITERATIONS } from './config/simulation';
export { HAND_RANKINGS, topPercentHands } from './config/hand-rankings';
export { VPIP_RANGE_NODES } from './config/vpip-ranges';
```

- [ ] **Step 2: Обновить app.ts:828 — использовать константы**

В `apps/app/src/app.ts` найти строку 828:

```ts
    const iterationsAllIn = board.length === 0 ? 3000 : 2000;
```

Заменить на (добавив импорт констант в начале файла, рядом с другими импортами из `@poker/core`):

```ts
    const iterationsAllIn = board.length === 0 ? PREFLOP_ITERATIONS : POSTFLOP_ITERATIONS;
```

И в блоке импортов из `@poker/core` (строка 1-8 файла) добавить:

```ts
  PREFLOP_ITERATIONS,
  POSTFLOP_ITERATIONS,
```

- [ ] **Step 3: Проверить сборку app**

Run: `cd ~/Projects/poker-assistant/packages/core && npm run build 2>&1 | tail -5`
Expected: без ошибок, CJS + ESM + DTS собраны.

Run: `cd ~/Projects/poker-assistant/apps/app && npx tsc --noEmit`
Expected: без ошибок (app.ts компилируется с новыми импортами).

- [ ] **Step 4: Коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/src/index.ts apps/app/src/app.ts
git commit -m "refactor(core): обновить фасад index.ts и app.ts под слоистую структуру"
```

---

### Task 10: Удалить старые файлы из корня src/

**Files:**
- Delete: `src/deck.ts`, `src/hand-eval.ts`, `src/nuts.ts`, `src/equity.ts`, `src/outs.ts`, `src/advice.ts`, `src/positions.ts`
- Delete: `src/nuts.test.ts`, `src/equity.test.ts`, `src/outs.test.ts`, `src/advice.test.ts`, `src/positions.test.ts`, `src/regressions.test.ts`, `src/marginal.test.ts`

**Важно:** перед удалением убедиться, что все 7 модулей успешно перенесены в подпапки (Tasks 6-8) и `index.ts` (Task 9) импортирует только из подпапок. `types.ts`, `index.ts`, `layer-deps.test.ts` остаются в корне.

- [ ] **Step 1: Удалить старые файлы**

```bash
cd ~/Projects/poker-assistant/packages/core
git rm src/deck.ts src/hand-eval.ts src/nuts.ts src/equity.ts src/outs.ts src/advice.ts src/positions.ts
git rm src/nuts.test.ts src/equity.test.ts src/outs.test.ts src/advice.test.ts src/positions.test.ts src/regressions.test.ts src/marginal.test.ts
```

- [ ] **Step 2: Проверить, что index.ts не ссылается на старые пути**

Run: `grep -n "from '\./[a-z-]*'" src/index.ts`
Expected: нет строк вида `from './deck'`, `from './hand-eval'` и т.д. — только `./types`, `./config/...`, `./players/...`, `./eval/...`, `./equity/...`, `./strategy/...`.

Если остались старые ссылки — исправить (вернуться к Task 9).

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: без ошибок. Если `Cannot find module './deck'` — где-то остался старый импорт.

- [ ] **Step 4: Запустить ВСЕ тесты**

Run: `npm test`
Expected: PASS. Все перенесённые тесты в подпапках зелёные. Должно быть ~40 тестов (точное число = исходные 40 в новых папках).

- [ ] **Step 5: Коммит**

```bash
cd ~/Projects/poker-assistant
git commit -m "refactor(core): удалить старые файлы из корня src/ — переезд в слои завершён"
```

---

### Task 11: Добавить `layer-deps.test.ts` — проверка слоистых зависимостей

**Files:**
- Create: `packages/core/src/layer-deps.test.ts`

**Interfaces:**
- Consumes: файловая система (`fs`), структура папок из Tasks 1-8.

Этот тест статически проверяет правило зависимостей: `config` не импортирует другие слои, `eval` не импортирует `equity`/`strategy`, и т.д. Предотвращает циклы в будущем.

- [ ] **Step 1: Написать тест**

`packages/core/src/layer-deps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname);

/** Извлечь пути импорта из файла. */
function getImports(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const matches = content.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g);
  return [...matches].map((m) => m[1]);
}

/** Получить слой (папку верхнего уровня) из пути импорта. */
function layerOf(relativeImport: string, fromFile: string): string | null {
  // Разрешить относительный путь относительно файла
  const resolved = join(dirname(fromFile), relativeImport).replace(/\.ts$/, '');
  // Нормализовать к виду src/<слой>/...
  const rel = resolved.replace(SRC + '/', '').replace(SRC, '');
  const parts = rel.split('/');
  if (parts.length < 2) return null; // файл в корне src/ (types.ts, index.ts)
  return parts[0]; // config | players | eval | equity | strategy
}

/** Все .ts файлы (кроме тестов и index/types) в подпапках. */
function collectLayerFiles(layer: string): string[] {
  const dir = join(SRC, layer);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(dir, f));
}

describe('слойные зависимости (нет циклов, зависимости только вниз)', () => {
  const LAYER_ALLOWS: Record<string, string[]> = {
    // config: ничего не импортирует из слоёв (только ../types)
    config: [],
    // players: только config
    players: ['config'],
    // eval: config (без players/equity/strategy)
    eval: ['config'],
    // equity: eval, config, players
    equity: ['eval', 'config', 'players'],
    // strategy: equity, eval, config, players
    strategy: ['equity', 'eval', 'config', 'players'],
  };

  for (const [layer, allowed] of Object.entries(LAYER_ALLOWS)) {
    it(`слой "${layer}" импортирует только из разрешённых слоёв: [${allowed.join(', ') || 'ничего'}]`, () => {
      const files = collectLayerFiles(layer);
      const violations: string[] = [];
      for (const file of files) {
        const imports = getImports(file);
        for (const imp of imports) {
          const depLayer = layerOf(imp, file);
          if (depLayer && depLayer !== layer && !allowed.includes(depLayer)) {
            violations.push(`${file.replace(SRC + '/', '')} → ${imp} (слой "${depLayer}")`);
          }
        }
      }
      expect(violations, violations.join('\n')).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Запустить тест (RED/GREEN — сразу должен пройти, т.к. структура уже корректна)**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test -- src/layer-deps.test.ts`
Expected: PASS, 5 тестов (по одному на слой).

Если падает — где-то нарушено правило зависимостей. Читать сообщение о violation, исправить импорт (например, `eval/` случайно импортирует из `equity/`), перезапустить.

- [ ] **Step 3: Коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/src/layer-deps.test.ts
git commit -m "test(core): layer-deps.test.ts — статическая проверка слоистых зависимостей"
```

---

### Task 12: Финальная проверка — сборка, все тесты, bump версии

**Files:**
- Modify: `packages/core/package.json` (version 1.2.0 → 1.3.0)
- Modify: `apps/app/package.json` (version 1.2.0 → 1.3.0)

- [ ] **Step 1: Полный прогон всех тестов core**

Run: `cd ~/Projects/poker-assistant/packages/core && npm test`
Expected: PASS, ~44 теста (40 перенесённых + 5 layer-deps + 5 hand-rankings + 4 vpip-ranges + 4 profiles — точное число из Tasks 3,4,5,11).

- [ ] **Step 2: Сборка core**

Run: `cd ~/Projects/poker-assistant/packages/core && npm run build`
Expected: CJS + ESM + DTS собраны без ошибок.

- [ ] **Step 3: Компиляция app**

Run: `cd ~/Projects/poker-assistant/apps/app && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Bump версии до 1.3.0**

В `packages/core/package.json`: `"version": "1.2.0"` → `"version": "1.3.0"`.
В `apps/app/package.json`: `"version": "1.2.0"` → `"version": "1.3.0"`.

- [ ] **Step 5: Финальный коммит**

```bash
cd ~/Projects/poker-assistant
git add packages/core/package.json apps/app/package.json
git commit -m "chore: bump версии до 1.3.0 — рефакторинг core завершён

Слоистая архитектура: config/ → players/ → eval/ → equity/ → strategy/
Магические числа вынесены в config/, заложен задел под фичу профилей
(VPIP/PFR): слой players/, 169 рук Sklansky, узлы VPIP_RANGE_NODES.
Поведение не изменилось, 44 теста зелёные."
```

- [ ] **Step 6: Сводка**

Вывести `git log main..HEAD --oneline` — показать все коммиты релиза v1.3.
Вывести `find packages/core/src -name "*.ts" | wc -l` — показать финальное число файлов.
