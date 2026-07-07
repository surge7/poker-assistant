# Фича: профили игроков (VPIP/PFR) — ядро Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Оживить фундамент профилей игроков: эквити против диапазонов оппонентов (по VPIP) и модификатор совета по PFR активного оппонента. Без UI — только ядро `packages/core`.

**Architecture:** Расширение существующей слоистой структуры v1.3.0. Монте-Карло получает опциональный `opponents[]` и раздаёт профильным оппонентам карты из их диапазонов (`statsToRange`), беспрофильным — случайные. Совет модифицирует порог фолда по PFR активного оппонента. Обратная совместимость: без `opponents` всё работает как раньше.

**Tech Stack:** TypeScript 5.3, vitest 2.1.9, tsup 8 (сборка), npm workspaces. Ветка `release/v1.2`.

## Global Constraints

- **UI не трогаем.** `apps/app/src/app.ts` НЕ редактируется. Только `packages/core`.
- **Обратная совместимость:** без `opponents`/`activeOpponentIndex` все функции работают идентично текущим. 60 существующих тестов остаются зелёными.
- **Слоистые зависимости** (из v1.3.0): `config → players → eval → equity → strategy`. `equity/` может импортировать из `players/` (уже разрешено слоем). Циклы запрещены — `layer-deps.test.ts` ловит.
- **TDD:** каждый шаг — RED (падающий тест) → GREEN (минимальная реализация) → коммит.
- **Рабочая папка для `npm test`/`npm run build`:** `/Users/gpbu25522/Projects/poker-assistant/packages/core`. Оболочка не сохраняет cwd — используйте `cd` в команде.
- **Пресеты игроков** (VPIP/PFR) — копируются дословно из §5.1 спеки: Неизвестен 0/0, Нит 12/10, TAG 22/18, LAG 35/28, Фиш 50/8, Маньяк 60/45.
- **PFR-модификатор** (из §5.4 спеки): `PFR_BASE=18`, `SENSITIVITY=0.015`, `MIN=0.8`, `MAX=1.3`. Формула `factor = clamp(1 + (BASE - pfr) * SENSITIVITY, MIN, MAX)`.

---

## File Structure

```
packages/core/src/
├── config/
│   ├── player-presets.ts       (NEW) 5 типов игроков
│   └── thresholds.ts           (MODIFY) +PFR-модификаторы
├── players/
│   ├── ranges.ts               (MODIFY) полная statsToRange
│   └── ranges.test.ts          (NEW)
├── equity/
│   └── equity.ts               (MODIFY) +опциональный opponents[]
├── strategy/
│   ├── advice.ts               (MODIFY) +модификатор порогов по PFR
│   └── advice.test.ts          (MODIFY) +тесты профилей
├── types.ts                    (MODIFY) +activeOpponentIndex
└── index.ts                    (MODIFY) +экспорт пресетов/модификаторов
```

**Ответственность файлов:**
- `config/player-presets.ts` — чистые данные (5 типов + `getPreset`).
- `players/ranges.ts` — `statsToRange` (VPIP→%→топ-N% рук), `vpid<=0 → []`.
- `equity/equity.ts` — Монте-Карло с диапазонами; кеш диапазонов до цикла.
- `strategy/advice.ts` — расчёт `pfrModifier`, применение к порогам, заметки в reason.
- `config/thresholds.ts` — 4 константы PFR-модификатора.

---

### Task 1: `config/player-presets.ts` — 5 типов игроков

**Files:**
- Create: `packages/core/src/config/player-presets.ts`
- Test: `packages/core/src/config/player-presets.test.ts`

**Interfaces:**
- Produces: `PlayerPresetKey` (union), `PlayerPreset` (interface), `PLAYER_PRESETS` (readonly array), `getPreset(key)`. Используются в Task 5 (advice может ссылаться), и в будущем UI.

- [ ] **Step 1: Написать падающий тест (RED)**

`packages/core/src/config/player-presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PLAYER_PRESETS, getPreset, type PlayerPresetKey } from './player-presets';

describe('player-presets (5 типов игроков)', () => {
  it('содержит 6 записей (unknown + 5 типов)', () => {
    expect(PLAYER_PRESETS).toHaveLength(6);
    const keys = PLAYER_PRESETS.map(p => p.key);
    expect(keys).toEqual(['unknown', 'nit', 'tag', 'lag', 'fish', 'maniac']);
  });

  it('первая запись — unknown (VPIP=0, PFR=0)', () => {
    expect(PLAYER_PRESETS[0].key).toBe('unknown');
    expect(PLAYER_PRESETS[0].vpip).toBe(0);
    expect(PLAYER_PRESETS[0].pfr).toBe(0);
  });

  it('TAG: VPIP=22, PFR=18 (эталонный агрессивно-тайтовый)', () => {
    const tag = getPreset('tag');
    expect(tag.vpip).toBe(22);
    expect(tag.pfr).toBe(18);
  });

  it('все VPIP и PFR в диапазоне 0..100, pfr <= vpip', () => {
    for (const p of PLAYER_PRESETS) {
      expect(p.vpip).toBeGreaterThanOrEqual(0);
      expect(p.vpip).toBeLessThanOrEqual(100);
      expect(p.pfr).toBeGreaterThanOrEqual(0);
      expect(p.pfr).toBeLessThanOrEqual(p.vpip); // PFR не превышает VPIP
    }
  });

  it('getPreset возвращает unknown для неизвестного ключа', () => {
    const r = getPreset('nonexistent' as PlayerPresetKey);
    expect(r.key).toBe('unknown');
  });

  it('Нит самый тайтовый (мин VPIP), Маньяк самый лузовый (макс VPIP)', () => {
    const nit = getPreset('nit');
    const maniac = getPreset('maniac');
    const nonUnknown = PLAYER_PRESETS.filter(p => p.key !== 'unknown');
    const minVpip = Math.min(...nonUnknown.map(p => p.vpip));
    const maxVpip = Math.max(...nonUnknown.map(p => p.vpip));
    expect(nit.vpip).toBe(minVpip);
    expect(maniac.vpip).toBe(maxVpip);
  });
});
```

- [ ] **Step 2: Запустить тест (RED)**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test -- src/config/player-presets.test.ts`
Expected: FAIL — `Cannot find module './player-presets'`.

- [ ] **Step 3: Реализовать player-presets.ts (GREEN)**

`packages/core/src/config/player-presets.ts` (значения из спеки §5.1 дословно):

```ts
/**
 * Предустановленные типы игроков с типичными VPIP/PFR.
 * Значения — стандартные оценки из покерной литературы.
 * Используются как быстрые пресеты в UI и как эталоны в тестах.
 */

export type PlayerPresetKey = 'unknown' | 'nit' | 'tag' | 'lag' | 'fish' | 'maniac';

export interface PlayerPreset {
  key: PlayerPresetKey;
  label: string;        // для UI
  description: string;  // краткое описание стиля
  vpip: number;
  pfr: number;
}

export const PLAYER_PRESETS: readonly PlayerPreset[] = [
  { key: 'unknown', label: 'Неизвестен', description: 'Случайная рука (нет данных)', vpip: 0, pfr: 0 },
  { key: 'nit', label: 'Нит', description: 'Тайтовый-пассивный, играет только премиум', vpip: 12, pfr: 10 },
  { key: 'tag', label: 'TAG', description: 'Тайтовый-агрессивный, оптимальный стиль', vpip: 22, pfr: 18 },
  { key: 'lag', label: 'LAG', description: 'Лузовый-агрессивный, много рейзов', vpip: 35, pfr: 28 },
  { key: 'fish', label: 'Фиш', description: 'Лузовый-пассивный, коллирует всё', vpip: 50, pfr: 8 },
  { key: 'maniac', label: 'Маньяк', description: 'Сверхагрессивный, блефует много', vpip: 60, pfr: 45 },
] as const;

/** Получить пресет по ключу. unknown для некорректного ключа. */
export function getPreset(key: PlayerPresetKey): PlayerPreset {
  return PLAYER_PRESETS.find((p) => p.key === key) ?? PLAYER_PRESETS[0];
}
```

- [ ] **Step 4: Запустить тест (GREEN)**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test -- src/config/player-presets.test.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 5: Коммит**

```bash
cd /Users/gpbu25522/Projects/poker-assistant
git add packages/core/src/config/player-presets.ts packages/core/src/config/player-presets.test.ts
git commit -m "feat(core): config/player-presets.ts — 5 типов игроков (VPIP/PFR)"
```

---

### Task 2: `players/ranges.ts` — полная `statsToRange`

**Files:**
- Modify: `packages/core/src/players/ranges.ts`
- Create: `packages/core/src/players/ranges.test.ts`

**Interfaces:**
- Consumes: `PlayerStats` (из `./profiles`), `VPIP_RANGE_NODES` (из `../config/vpip-ranges`), `topPercentHands` (из `../config/hand-rankings`).
- Produces: `statsToRange(stats: PlayerStats): readonly string[]` — при `vpip<=0` возвращает `[]`, иначе топ-N% рук.

- [ ] **Step 1: Написать падающий тест (RED)**

`packages/core/src/players/ranges.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { statsToRange } from './ranges';
import type { PlayerStats } from './profiles';

describe('players/ranges — statsToRange', () => {
  it('vpid<=0 (неизвестный игрок) → пустой массив (сигнал «случайная рука»)', () => {
    expect(statsToRange({ vpip: 0, pfr: 0 })).toEqual([]);
  });

  it('TAG (VPIP=22) → непустой диапазон ~25% рук', () => {
    const range = statsToRange({ vpip: 22, pfr: 18 });
    expect(range.length).toBeGreaterThan(0);
    // ~25% из 169 = ~42 руки. Допуск ±10.
    expect(range.length).toBeGreaterThan(30);
    expect(range.length).toBeLessThan(55);
  });

  it('Нит (VPIP=12) уже чем TAG (VPIP=22)', () => {
    const nit = statsToRange({ vpip: 12, pfr: 10 });
    const tag = statsToRange({ vpip: 22, pfr: 18 });
    expect(nit.length).toBeLessThan(tag.length);
  });

  it('Маньяк (VPIP=60) шире всех', () => {
    const maniac = statsToRange({ vpip: 60, pfr: 45 });
    const nit = statsToRange({ vpip: 12, pfr: 10 });
    expect(maniac.length).toBeGreaterThan(nit.length);
    // ~65% из 169 = ~110 рук.
    expect(maniac.length).toBeGreaterThan(90);
  });

  it('AA всегда в диапазоне любого игрока (кроме unknown)', () => {
    const tag = statsToRange({ vpip: 22, pfr: 18 } as PlayerStats);
    expect(tag).toContain('AA');
  });
});
```

- [ ] **Step 2: Запустить тест (RED)**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test -- src/players/ranges.test.ts`
Expected: FAIL — `vpip: 0` возвращает диапазон (в текущей заглушке нет проверки `vpip<=0`), или модуль не найден.

- [ ] **Step 3: Обновить ranges.ts (GREEN)**

Открыть `packages/core/src/players/ranges.ts` и заменить функцию `statsToRange`. Текущая заглушка уже работает для vpip>0, но нужно добавить проверку `vpip<=0 → []`:

```ts
import type { PlayerStats } from './profiles';
import { VPIP_RANGE_NODES } from '../config/vpip-ranges';
import { topPercentHands } from '../config/hand-rankings';

/**
 * Перевод метрик игрока в диапазон рук.
 * Интерполяция % диапазона по VPIP между узлами VPIP_RANGE_NODES,
 * затем топ-N% из 169 рук (hand-rankings.ts).
 *
 * При vpip<=0 (неизвестный игрок) возвращает пустой массив —
 * это сигнал для equity «раздавать случайную руку из всей колоды».
 */
export function statsToRange(stats: PlayerStats): readonly string[] {
  if (stats.vpip <= 0) return [];
  const rangePct = interpolateVpipToRange(clamp(stats.vpip, 0, 100));
  return topPercentHands(rangePct);
}

/** Линейная интерполяция между узлами VPIP_RANGE_NODES. Клиппинг за границами. */
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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
```

- [ ] **Step 4: Запустить тест (GREEN)**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test -- src/players/ranges.test.ts`
Expected: PASS, 5 тестов.

- [ ] **Step 5: Коммит**

```bash
cd /Users/gpbu25522/Projects/poker-assistant
git add packages/core/src/players/ranges.ts packages/core/src/players/ranges.test.ts
git commit -m "feat(core): players/ranges.ts — полная statsToRange (vpip<=0 → пусто)"
```

---

### Task 3: `equity/equity.ts` — Монте-Карло с диапазонами оппонентов

**Files:**
- Modify: `packages/core/src/equity/equity.ts`
- Modify: `packages/core/src/equity/equity.test.ts` (добавить тесты)

**Interfaces:**
- Consumes: `Opponent` (из `../players/profiles`), `statsToRange` (из Task 2), `Card` (из `../types`).
- Produces: `equity`, `equityPercent`, `equityPercentRange` — все с опциональным параметром `opponents?: Opponent[]` последним аргументом.

Это самая сложная задача: расширение цикла Монте-Карло. Текущий цикл (строки 52-70 в equity.ts) раздаёт всем оппонентам случайные карты через `remaining.splice(0, 2)`. Нужно для профильных оппонентов брать карты из их диапазона.

- [ ] **Step 1: Написать падающие тесты (RED)**

Добавить в конец `packages/core/src/equity/equity.test.ts` (после существующих тестов):

```ts
import { equity, equityPercent } from './equity';
import type { Opponent } from '../players/profiles';

describe('эквити против диапазонов оппонентов (VPIP)', () => {
  it('AA vs нит (VPIP 12) даёт ВЫШЕ эквити, чем vs случайная рука', () => {
    // Нит играет только топ-15% рук — его диапазон сильнее среднего, но... подождите.
    // На самом деле: если у оппонента СИЛЬНЫЙ диапазон, эквити AA ПРОТИВ него НИЖЕ
    // (он чаще попадает в пару/сет/флеш). Проверяем обратное.
    // AA vs случайная рука ~85%. AA vs нит (топ-15%, сильные руки) — эквити НИЖЕ.
    const vsRandom = equityPercent(['Ah', 'Ad'], [], 1, 3000);
    const nitOpp: Opponent[] = [{ position: 1, stats: { vpip: 12, pfr: 10 } }];
    const vsNit = equityPercent(['Ah', 'Ad'], [], 1, 3000, nitOpp);
    // Нит попадает в KK/QQ/AK чаще → наш AA выигрывает реже.
    expect(vsNit).toBeLessThan(vsRandom);
  });

  it('AA vs маньяк (VPIP 60) даёт эквити, близкое к случайной руке', () => {
    // Маньяк играет топ-65% — почти весь спектр, близко к случайной.
    const vsRandom = equityPercent(['Ah', 'Ad'], [], 1, 3000);
    const maniacOpp: Opponent[] = [{ position: 1, stats: { vpip: 60, pfr: 45 } }];
    const vsManiac = equityPercent(['Ah', 'Ad'], [], 1, 3000, maniacOpp);
    // Разница < 5 п.п. (диапазон маньяка почти как случайный).
    expect(Math.abs(vsRandom - vsManiac)).toBeLessThan(6);
  });

  it('оппонент без stats (unknown) = случайная рука (обратная совместимость)', () => {
    const vsRandom = equityPercent(['Ah', 'Ad'], [], 1, 2000);
    const unknownOpp: Opponent[] = [{ position: 1 }]; // без stats
    const vsUnknown = equityPercent(['Ah', 'Ad'], [], 1, 2000, unknownOpp);
    expect(vsUnknown).toBe(vsRandom); // идентично (тот же seed)
  });

  it('без opponents — обратная совместимость (как раньше)', () => {
    const a = equityPercent(['Ah', 'Kh'], [], 1, 2000);
    const b = equityPercent(['Ah', 'Kh'], [], 1, 2000);
    expect(a).toBe(b); // детерминизм сохранён
  });
});
```

- [ ] **Step 2: Запустить тест (RED)**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test -- src/equity/equity.test.ts`
Expected: FAIL — `equityPercent(..., opponents)` передаёт 5-й аргумент, но сигнатура его не принимает (TypeScript error) или игнорируется.

- [ ] **Step 3: Расширить equity.ts — сигнатуры и логику диапазонов (GREEN)**

Открыть `packages/core/src/equity/equity.ts`. Изменения:

**3a. Добавить импорт:**
```ts
import { createDeck, fillRemaining, shuffleInPlace } from '../eval/deck';
import { evaluatePlayerHand, compareHands } from '../eval/hand-eval';
import { DEFAULT_ITERATIONS } from '../config/simulation';
import { statsToRange } from '../players/ranges';
import type { Opponent } from '../players/profiles';
import type { Card } from '../types';
```

**3b. Расширить сигнатуру `equity`:**
```ts
export function equity(
  holeCards: Card[],
  board: Card[],
  numOpponents: number = 1,
  iterations: number = DEFAULT_ITERATIONS,
  opponents?: Opponent[],
): { win: number; tie: number; lose: number; total: number } {
```

**3c. Перед циклом — предвычислить диапазоны оппонентов (кеш).** После строки `const random = seededRandom(seed);` добавить:
```ts
  // Предвычислить диапазоны оппонентов один раз (кеш). empty = случайная рука.
  const oppRanges: Card[][] = [];
  for (let o = 0; o < numOpponents; o++) {
    const opp = opponents?.[o];
    if (opp?.stats && opp.stats.vpip > 0) {
      const range = statsToRange(opp.stats) as Card[];
      oppRanges.push(range.length >= 2 ? range : []);
    } else {
      oppRanges.push([]); // пустой = случайная рука из remaining
    }
  }
```

**3d. Заменить блок раздачи оппонентам (строки 60-64 оригинала).** Заменить:
```ts
    let bestOpp = evaluatePlayerHand(remaining.splice(0, 2), newBoard);
    for (let o = 1; o < numOpponents; o++) {
      const oppHand = evaluatePlayerHand(remaining.splice(0, 2), newBoard);
      if (compareHands(oppHand, bestOpp) > 0) bestOpp = oppHand;
    }
```
на:
```ts
    let bestOpp = evaluatePlayerHand(dealOpponent(oppRanges[0], remaining, random, usedInDeal), newBoard);
    for (let o = 1; o < numOpponents; o++) {
      const oppHand = evaluatePlayerHand(dealOpponent(oppRanges[o], remaining, random, usedInDeal), newBoard);
      if (compareHands(oppHand, bestOpp) > 0) bestOpp = oppHand;
    }
```

**3e. Подготовить `usedInDeal` и функцию `dealOpponent`.** В начале цикла (после `shuffleInPlace(remaining, random);`) добавить множество уже розданных в этой итерации карт:
```ts
    const usedInDeal = new Set<Card>([...holeCards, ...newBoard]);
```

Добавить вспомогательную функцию `dealOpponent` **вне** `equity` (модульный уровень, перед `equity`):
```ts
/**
 * Раздать 2 карты оппоненту.
 * Если range непустой — взять 2 случайные карты из range, не пересекающиеся с used.
 * Если range пустой или в нём <2 свободных карт — fallback к 2 картам из pool (remaining).
 * Карты удаляются из pool (splice), из range — нет (range кеширован).
 */
function dealOpponent(
  range: Card[],
  pool: Card[],
  random: () => number,
  used: Set<Card>,
): Card[] {
  if (range.length >= 2) {
    // Собрать доступные карты из диапазона (не в used).
    const available = range.filter((c) => !used.has(c) && pool.includes(c));
    if (available.length >= 2) {
      // Случайные 2 из available.
      shuffleInPlace(available, random);
      const [c1, c2] = available;
      // Удалить из pool.
      removeFirst(pool, c1);
      removeFirst(pool, c2);
      used.add(c1);
      used.add(c2);
      return [c1, c2];
    }
  }
  // Fallback: случайные 2 из pool (как раньше).
  const c1 = pool.splice(0, 1)[0];
  const c2 = pool.splice(0, 1)[0];
  used.add(c1);
  used.add(c2);
  return [c1, c2];
}

/** Удалить первое вхождение элемента из массива (на месте). */
function removeFirst(arr: Card[], item: Card): void {
  const idx = arr.indexOf(item);
  if (idx >= 0) arr.splice(idx, 1);
}
```

**3f. Расширить `equityPercent` и `equityPercentRange`** — добавить опциональный параметр `opponents` и пробросить в `equity`:
```ts
export function equityPercent(
  holeCards: Card[],
  board: Card[],
  numOpponents: number = 1,
  iterations: number = DEFAULT_ITERATIONS,
  opponents?: Opponent[],
): number {
  const e = equity(holeCards, board, numOpponents, iterations, opponents);
  return Math.round((e.win + e.tie / 2) * 100);
}

export function equityPercentRange(
  holeCards: Card[],
  board: Card[],
  numOpponents: number = 1,
  iterations: number = DEFAULT_ITERATIONS,
  opponents?: Opponent[],
): { percent: number; low: number; high: number } {
  const e = equity(holeCards, board, numOpponents, iterations, opponents);
  // ... остальное без изменений ...
}
```

- [ ] **Step 4: Запустить тесты (GREEN)**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test -- src/equity/equity.test.ts`
Expected: PASS, все тесты (7 старых + 4 новых = 11).

Если тест «AA vs нит < vs случайная» падает (эквити оказалось выше, а не ниже) — это значит диапазон нита оказался слабее случайного. Проверьте логику: AA против топ-15% рук должен иметь НИЖЕ эквити, т.к. топ-15% включает KK/QQ/AK, которые чаще доминируют или крадут банк. Если тест упал в обратную сторону — инвертируйте ассерт (`vsNit > vsRandom` было бы неверно математически; правильное ожидание `vsNit < vsRandom`). Убедитесь что `statsToRange` нита возвращает ~25 рук (топ-15%), и что `dealOpponent` берёт из них.

- [ ] **Step 5: Прогон всех тестов**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test`
Expected: PASS, ~64 теста (60 + 4 новых). Существующие не сломаны.

- [ ] **Step 6: Коммит**

```bash
cd /Users/gpbu25522/Projects/poker-assistant
git add packages/core/src/equity/equity.ts packages/core/src/equity/equity.test.ts
git commit -m "feat(core): эквити против диапазонов оппонентов (Монте-Карло + VPIP)"
```

---

### Task 4: `config/thresholds.ts` PFR-модификаторы + `types.ts` activeOpponentIndex

**Files:**
- Modify: `packages/core/src/config/thresholds.ts` (+4 константы)
- Modify: `packages/core/src/types.ts` (+activeOpponentIndex в TableContext)

**Interfaces:**
- Produces: `PFR_BASE`, `PFR_MODIFIER_SENSITIVITY`, `PFR_MODIFIER_MIN`, `PFR_MODIFIER_MAX` (используются в Task 5); `TableContext.activeOpponentIndex?: number`.

- [ ] **Step 1: Добавить константы в thresholds.ts**

В конец `packages/core/src/config/thresholds.ts` добавить (значения из спеки §5.4 дословно):

```ts
/**
 * Модификатор порога фолда по агрессивности активного оппонента (PFR).
 * Низкий PFR (нит-рейз ~10) → его ставка весомее → фолд шире → множитель > 1.
 * Высокий PFR (маньяк ~45) → он блефует → колл шире → множитель < 1.
 * Базовый PFR (TAG ~18) → множитель = 1 (без изменения).
 *
 * Формула: factor = clamp(1 + (PFR_BASE - opponentPfr) * SENSITIVITY, MIN, MAX)
 */
export const PFR_BASE = 18;
export const PFR_MODIFIER_SENSITIVITY = 0.015;
export const PFR_MODIFIER_MIN = 0.8;
export const PFR_MODIFIER_MAX = 1.3;
```

- [ ] **Step 2: Добавить activeOpponentIndex в types.ts**

В `packages/core/src/types.ts`, в интерфейс `TableContext`, после `opponents?: Opponent[];` добавить:

```ts
  /** Индекс активного оппонента (ставщика) в opponents[]. Используется для PFR-модификатора. */
  activeOpponentIndex?: number;
```

- [ ] **Step 3: Проверить компиляцию**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Коммит**

```bash
cd /Users/gpbu25522/Projects/poker-assistant
git add packages/core/src/config/thresholds.ts packages/core/src/types.ts
git commit -m "feat(core): PFR-модификаторы порогов + activeOpponentIndex в TableContext"
```

---

### Task 5: `strategy/advice.ts` — модификатор порогов по PFR активного оппонента

**Files:**
- Modify: `packages/core/src/strategy/advice.ts`
- Modify: `packages/core/src/strategy/advice.test.ts` (+тесты)

**Interfaces:**
- Consumes: `PFR_BASE`, `PFR_MODIFIER_SENSITIVITY`, `PFR_MODIFIER_MIN`, `PFR_MODIFIER_MAX` (из Task 4), `TableContext.opponents`/`activeOpponentIndex` (из Task 4).
- Produces: `getAdvice` учитывает PFR активного оппонента в порогах фолда и добавляет заметку в reason.

- [ ] **Step 1: Написать падающие тесты (RED)**

Добавить в конец `packages/core/src/strategy/advice.test.ts`:

```ts
import type { Opponent } from '../players/profiles';

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
    expect(result.reason).toMatch(/тайтов|PFR|весомее|фолд/i);
  });

  it('против маньяка (PFR 45) порог фолда ниже → совет мягче к коллу', () => {
    const maniac: Opponent[] = [{ position: 1, stats: { vpip: 60, pfr: 45 } }];
    const ctx = baseCtx({ opponents: maniac, activeOpponentIndex: 0 });
    const result = getAdvice(ctx);
    expect(result.reason).toMatch(/агрессив|блеф|колл|шире/i);
  });

  it('без activeOpponentIndex модификатор не применяется (обратная совместимость)', () => {
    const nit: Opponent[] = [{ position: 1, stats: { vpip: 12, pfr: 10 } }];
    const ctx = baseCtx({ opponents: nit }); // без activeOpponentIndex
    const result = getAdvice(ctx);
    // Не должно быть заметки про тайтового оппонента.
    expect(result.reason).not.toMatch(/тайтов|весомее/i);
  });

  it('без opponents вообще — как раньше (обратная совместимость)', () => {
    const ctx = baseCtx({});
    const result = getAdvice(ctx);
    expect(result.action).toBeDefined();
  });
});
```

- [ ] **Step 2: Запустить тесты (RED)**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test -- src/strategy/advice.test.ts`
Expected: FAIL — новые тесты падают (заметки про PFR не появляются, т.к. модификатор ещё не реализован).

- [ ] **Step 3: Реализовать модификатор в advice.ts (GREEN)**

Открыть `packages/core/src/strategy/advice.ts`.

**3a. Добавить импорт констант** (к существующему импорту из `'../config/thresholds'`):
```ts
  PFR_BASE,
  PFR_MODIFIER_SENSITIVITY,
  PFR_MODIFIER_MIN,
  PFR_MODIFIER_MAX,
```

**3b. После расчёта `marginalNote` (примерно строка 70) добавить расчёт pfrModifier.** Найти место после `const marginalNote = ...;` и добавить:
```ts
  // PFR-модификатор порога фолда по агрессивности активного оппонента.
  const activeOpp = ctx.opponents?.[ctx.activeOpponentIndex ?? -1];
  const activePfr = activeOpp?.stats && activeOpp.stats.pfr > 0 ? activeOpp.stats.pfr : PFR_BASE;
  const pfrModifier = clampPfr(
    1 + (PFR_BASE - activePfr) * PFR_MODIFIER_SENSITIVITY,
  );
  const oppNote =
    pfrModifier > 1.05
      ? ` Против тайтового оппонента (PFR ~${activePfr}%) его ставка весомее — фолд оправданнее.`
      : pfrModifier < 0.95
      ? ` Против агрессивного оппонента (PFR ~${activePfr}%) можно коллить шире — он часто блефует.`
      : '';
```

**3c. Добавить helper `clampPfr`** в конец файла (перед `getAdvice` или после, на уровне модуля):
```ts
function clampPfr(v: number): number {
  return Math.max(PFR_MODIFIER_MIN, Math.min(PFR_MODIFIER_MAX, v));
}
```

**3d. Применить `pfrModifier` к порогам фолда.** Найти строку `const foldBarPct = ...` (с `FOLD_EQUITY_MULTIPLIER`/`FOLD_BAR_*`) и умножить на `pfrModifier`:
```ts
  const foldBarPct = toCall > 0
    ? Math.max(requiredEquityPct * FOLD_EQUITY_MULTIPLIER, latePos ? FOLD_BAR_LATE_PCT : FOLD_BAR_EARLY_PCT) * pfrModifier
    : 100;
```

**3e. Добавить `oppNote` в reason фолдов.** Найти return-блоки `action: 'fold'` (их два — «слабая рука и мало аутов» и «эквити ниже требуемой») и добавить `${oppNote}` в конец строки `reason`. Например:
```ts
      reason: `${weakHandNote}, эквити ~${eq}% при требуемых ~${Math.round(requiredEquityPct)}%.${latePos ? ' ...' : ''}${potNote}${oppNote}`,
```
и
```ts
      reason: `Эквити ~${eq}% ниже требуемых для колла ... фолд.${latePos ? ' ...' : ''}${marginalNote}${oppNote}`,
```

- [ ] **Step 4: Запустить тесты (GREEN)**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test -- src/strategy/advice.test.ts`
Expected: PASS, все тесты (12 старых + 4 новых = 16).

- [ ] **Step 5: Прогон всех тестов**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test`
Expected: PASS, ~68 тестов (64 + 4 новых).

- [ ] **Step 6: Коммит**

```bash
cd /Users/gpbu25522/Projects/poker-assistant
git add packages/core/src/strategy/advice.ts packages/core/src/strategy/advice.test.ts
git commit -m "feat(core): модификатор порогов совета по PFR активного оппонента"
```

---

### Task 6: `index.ts` — экспорт пресетов и PFR-констант

**Files:**
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `PLAYER_PRESETS`, `getPreset`, `PlayerPresetKey`, `PlayerPreset` (из Task 1), `PFR_BASE`/`PFR_MODIFIER_*` (из Task 4) в публичном API.

- [ ] **Step 1: Добавить экспорты в index.ts**

В `packages/core/src/index.ts`, в секцию конфигов (после `VPIP_RANGE_NODES`), добавить:

```ts
export { PLAYER_PRESETS, getPreset } from './config/player-presets';
export type { PlayerPresetKey, PlayerPreset } from './config/player-presets';
export {
  PFR_BASE,
  PFR_MODIFIER_SENSITIVITY,
  PFR_MODIFIER_MIN,
  PFR_MODIFIER_MAX,
} from './config/thresholds';
```

- [ ] **Step 2: Проверить сборку**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm run build 2>&1 | tail -5`
Expected: CJS + ESM + DTS без ошибок.

- [ ] **Step 3: Коммит**

```bash
cd /Users/gpbu25522/Projects/poker-assistant
git add packages/core/src/index.ts
git commit -m "feat(core): экспорт пресетов игроков и PFR-констант в публичный API"
```

---

### Task 7: Bump версии до 1.4.0 + финальная проверка

**Files:**
- Modify: `packages/core/package.json` (1.3.0 → 1.4.0)
- Modify: `apps/app/package.json` (1.3.0 → 1.4.0)

- [ ] **Step 1: Полный прогон тестов**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm test`
Expected: PASS, ~68 тестов. Все 60 существующих + ~8 новых зелёные.

- [ ] **Step 2: Сборка core**

Run: `cd /Users/gpbu25522/Projects/poker-assistant/packages/core && npm run build`
Expected: CJS + ESM + DTS без ошибок.

- [ ] **Step 3: Проверить, что app.ts НЕ изменён**

Run: `cd /Users/gpbu25522/Projects/poker-assistant && git diff apps/app/src/app.ts`
Expected: пусто (UI не трогали).

- [ ] **Step 4: Bump версии**

В `packages/core/package.json`: `"version": "1.3.0"` → `"version": "1.4.0"`.
В `apps/app/package.json`: `"version": "1.3.0"` → `"version": "1.4.0"`.

- [ ] **Step 5: Коммит**

```bash
cd /Users/gpbu25522/Projects/poker-assistant
git add packages/core/package.json apps/app/package.json
git commit -m "chore: bump версии до 1.4.0 — фича профилей (ядро, без UI)

Эквити против диапазонов оппонентов (по VPIP), модификатор порогов
совета по PFR активного оппонента, 5 пресетов игроков. API готов под
будущий UI. apps/app не изменён. ~68 тестов зелёные."
```

- [ ] **Step 6: Сводка**

Вывести `git log --oneline main..HEAD` — все коммиты фичи профилей.
