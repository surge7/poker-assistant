# Фича: профили игроков (VPIP/PFR) — эквити против диапазонов (только ядро)

**Дата:** 2026-07-06
**Ветка:** `main`
**Целевая версия:** v1.4.0
**Предыдущий релиз:** v1.3.0 (рефакторинг core, все магические числа вынесены в config)

---

## 1. Контекст

Релиз v1.3.0 заложил фундамент: слой `players/` (типы `PlayerStats`, `Opponent`, функция `raiseFactor`), конфиги `config/hand-rankings.ts` (169 рук), `config/vpip-ranges.ts` (узлы VPIP→% диапазона), опциональные поля `opponents` и `activeOpponentIndex` в `TableContext`. Но эти поля пока **не используются** — эквити считает против случайных рук, совет не различает оппонентов.

Эта фича оживляет фундамент: эквити считает против диапазонов оппонентов (по VPIP), совет модифицируется по PFR активного оппонента (ставщика). UI не входит — он будет отдельным релизом.

## 2. Цели

1. **Эквити против диапазонов.** Монте-Карло раздаёт оппонентам с профилем карты из топ-N% их диапазона (по VPIP), без профиля — из всей колоды (обратная совместимость).
2. **Модификатор совета по профилю.** Против нит-рейза (низкий PFR) — фолд шире; против маньяка (высокий PFR) — колл шире.
3. **API-контракт для будущего UI.** `TableContext` принимает `opponents[]` и `activeOpponentIndex`; будущий UI лишь собирает эти данные из полей.
4. **Обратная совместимость.** Без профилей всё работает как раньше (79 тестов остаются зелёными).

## 3. Нецели

- **UI ввода профилей** — отдельный релиз.
- Не делаем имплайд-оддсы, стеки, GTO-солвер.
- Не трогаем `apps/app` (`apps/app/src/app.ts` НЕ редактируется).

## 4. Архитектура

Используем существующую слоистую структуру v1.3.0. Изменения **только в `packages/core`**:

```
packages/core/src/
├── config/
│   ├── player-presets.ts          НОВЫЙ: 5 типов игроков
│   ├── thresholds.ts        MODIFY: +PFR-модификаторы порогов
│   ├── (hand-rankings, vpip-ranges — без изменений)
├── players/
│   ├── ranges.ts            MODIFY: полная statsToRange (сейчас заглушка)
│   └── (profiles.ts — без изменений)
├── equity/
│   └── equity.ts            MODIFY: Монте-Карло с диапазонами оппонентов
├── strategy/
│   └── advice.ts            MODIFY: модификатор порогов по PFR активного оппонента
├── types.ts                 MODIFY: +activeOpponentIndex?
└── index.ts                 MODIFY: экспорт пресетов/модификаторов
```

### 4.1. Data flow

```
Будущий UI
  └─ getAdvice({ ..., opponents, activeOpponentIndex })
     ├─ equityPercentRange(holeCards, board, numOpp, iter, opponents)
     │   └─ Монте-Карло: оппонентам с stats → карты из statsToRange(stats)
     │                              без stats → случайные из колоды
     ├─ модификатор порога: PFR активного оппонента → foldBarPct *= factor
     └─ совет с учётом модифицированного порога
```

## 5. Детали модулей

### 5.1. `config/player-presets.ts` (НОВЫЙ)

5 предустановленных типов игроков с типичными VPIP/PFR.

```ts
export type PlayerPresetKey = 'unknown' | 'nit' | 'tag' | 'lag' | 'fish' | 'maniac';
export interface PlayerPreset {
  key: PlayerPresetKey;
  label: string;        // для UI
  description: string;  // для UI
  vpip: number;
  pfr: number;
}
export const PLAYER_PRESETS: readonly PlayerPreset[] = [
  { key: 'unknown', label: 'Неизвестен', description: 'Случайная рука', vpip: 0, pfr: 0 },
  { key: 'nit',     label: 'Нит',   description: 'Тайтовый-пассивный, играет только премиум', vpip: 12, pfr: 10 },
  { key: 'tag',     label: 'TAG',   description: 'Тайтовый-агрессивный, оптимальный стиль',     vpip: 22, pfr: 18 },
  { key: 'lag',     label: 'LAG',   description: 'Лузовый-агрессивный, много рейзов',          vpip: 35, pfr: 28 },
  { key: 'fish',    label: 'Фиш',   description: 'Лузовый-пассивный, коллирует всё',          vpip: 50, pfr: 8 },
  { key: 'maniac',  label: 'Маньяк', description: 'Сверхагрессивный, блефует много',           vpip: 60, pfr: 45 },
] as const;
export function getPreset(key: PlayerPresetKey): PlayerPreset { ... }
```

### 5.2. `players/ranges.ts` — полная `statsToRange`

Сейчас заглушка. Дополняется:
- При `vpip <= 0` → `[]` (сигнал «случайная рука»).
- При `vpip > 0` → интерполяция между узлами `VPIP_RANGE_NODES` → `rangePct` → `topPercentHands(rangePct)`.

Логика интерполяции:
```ts
export function statsToRange(stats: PlayerStats): readonly string[] {
  if (stats.vpip <= 0) return [];
  const rangePct = interpolateVpipToRange(clamp(stats.vpip, 0, 100));
  return topPercentHands(rangePct);
}
```

### 5.3. `equity/equity.ts` — Монте-Карло с диапазонами

Сигнатуры расширяются опциональным `opponents`:

```ts
export function equity(
  holeCards: Card[],
  board: Card[],
  numOpponents: number = 1,
  iterations: number = DEFAULT_ITERATIONS,
  opponents?: Opponent[],
): { win: number; tie: number; lose: number; total: number }
```

В цикле Монте-Карло:
- **Перед циклом**: предвычислить `oppRanges` — для каждого оппонента `o` кеш `statsToRange` (если есть stats). Пустой массив = случайная рука.
- **В итерации**: для каждого оппонента брать 2 случайные карты из его диапазона. Если в диапазоне осталось <2 свободных карт (пересекаются с board/нашими/другими оппонентами) — **fallback к случайной руке из пула**.
- **Без opponents**: текущая логика (случайная рука из пула).

`equityPercent` и `equityPercentRange` получают тот же опц. параметр.

### 5.4. `config/thresholds.ts` (MODIFY — PFR-модификаторы)

```ts
/**
 * Модификатор порога фолда по агрессивности активного оппонента (PFR).
 * Низкий PFR (нит-рейз ~10) → множитель > 1 (фолд шире).
 * Высокий PFR (маньяк ~45) → множитель < 1 (колл шире).
 * TAG (~18) → множитель = 1.
 *
 * Формула: factor = clamp(1 + (PFR_BASE - opponentPfr) * SENSITIVITY, MIN, MAX)
 */
export const PFR_BASE = 18;
export const PFR_MODIFIER_SENSITIVITY = 0.015;
export const PFR_MODIFIER_MIN = 0.8;
export const PFR_MODIFIER_MAX = 1.3;
```

Примеры:
- Нит (PFR 10): 1 + (18-10)*0.015 = 1.12 → 22% × 1.12 = 24.6% (×1.12 к fold-bar, фолд шире)
- Маньяк (PFR 45): 1 + (18-45)*0.015 = 0.595 → clamp 0.8 → ×0.8 (колл шире)

### 5.5. `strategy/advice.ts` (MODIFY — модификатор порогов)

«Активный оппонент» = `opponents[activeOpponentIndex]` при `toCall > 0`. Если индекс не задан, за пределами, или у оппонента нет `stats` → множитель = 1 (без изменения).

В начале `getAdvice`:
```ts
const activeOpp = ctx.opponents?.[ctx.activeOpponentIndex ?? -1];
const activePfr = activeOpp?.stats && activeOpp.stats.pfr > 0 ? activeOpp.stats.pfr : PFR_BASE;
const pfrModifier = clampPfr(1 + (PFR_BASE - activePfr) * PFR_MODIFIER_SENSITIVITY);
const oppNote =
  pfrModifier > 1.05
    ? ` Против тайтового оппонента (PFR ~${activePfr}%) его ставка весомее — фолд оправданнее.`
    : pfrModifier < 0.95
    ? ` Против агрессивного оппонента (PFR ~${activePfr}%) можно коллить шире — он часто блефует.`
    : '';
```

Множитель применяется к порогу фолда `foldBarPct` (умножением). Заметка `oppNote` добавляется к reason фолдов.

### 5.6. `types.ts` (MODIFY — TableContext)

```ts
export interface TableContext {
  // ... существующие поля ...
  opponents?: Opponent[];          // уже есть (v1.3)
  activeOpponentIndex?: number;    // НОВОЕ
}
```

## 6. План миграции (поэтапный)

Каждый шаг — TDD. После каждого — полный прогон тестов.

1. `config/player-presets.ts` + тесты
2. `players/ranges.ts` — полная `statsToRange` + тесты
3. `equity/equity.ts` — Монте-Карло с диапазонами + тесты
4. `config/thresholds.ts` — PFR-модификаторы + `types.ts` activeOpponentIndex
5. `strategy/advice.ts` — модификатор порогов + заметки в reason + тесты
6. `index.ts` — экспорт пресетов/модификаторов
7. Bump до v1.4.0, финальная сборка

**UI — отдельный релиз, здесь не трогаем.**

## 7. Тесты

- **Новые unit-тесты:**
  - `config/player-presets.test.ts` — 5 типов, метрики в 0..100, pfr ≤ vpip.
  - `players/ranges.test.ts` — statsToRange для нит/TAG/маньяк, `vpip<=0 → []`.
  - `equity/equity.test.ts` — AA vs нит (топ-15%, сильные) → эквити НИЖЕ vs случайной. AA vs маньяк ≈ vs случайная (его диапазон широк). Unknown = случайная.
  - `strategy/advice.test.ts` — нит (PFR 10) → фолд; маньяк (PFR 45) → колл (на грани); без opponents/activeOpponentIndex — обратная совместимость.
- **Существующие 79 тестов** остаются зелёными (без opponents всё как раньше).

## 8. Критерий готовности

- [ ] statsToRange полная (vpip<=0 → пусто)
- [ ] Эквити против диапазонов работает (AA vs нит < vs случайная)
- [ ] Совет модифицируется по PFR активного оппонента
- [ ] API-контракт готов под будущий UI
- [ ] 79 существующих + ~10 новых тестов зелёные
- [ ] apps/app не изменён
- [ ] Bump до v1.4.0
