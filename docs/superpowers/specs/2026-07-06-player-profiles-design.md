# Фича: профили игроков (VPIP/PFR) — эквити против диапазонов (ядро, без UI)

**Дата:** 2026-07-06
**Ветка:** `release/v1.2` (продолжение)
**Целевая версия:** v1.4.0
**Предыдущий релиз:** v1.3.0 (рефакторинг core, фундамент профилей)

---

## 1. Контекст и мотивация

Релиз v1.3.0 заложил фундамент: слой `players/` (типы `PlayerStats`, `Opponent`, функция `raiseFactor`), конфиги `config/hand-rankings.ts` (169 рук Sklansky), `config/vpip-ranges.ts` (узлы VPIP → %), опциональное поле `opponents` в `TableContext`. Но эти поля пока **не используются** — эквити считает против случайных рук, совет не различает оппонентов.

Эта фича оживляет фундамент: пользователь задаёт каждому оппоненту VPIP/PFR (или выбирает пресет), эквити считается против диапазонов, совет модифицируется по профилю активного оппонента (ставщика).

## 2. Цели

1. **Эквити против диапазонов.** Монте-Карло раздаёт оппонентам с профилем карты из топ-N% их диапазона (по VPIP), без профиля — из всей колоды (обратная совместимость).
2. **Модификатор совета по профилю.** Против нит-рейза (низкий PFR) — фолд шире (у него сильная рука); против маньяка (высокий PFR) — колл шире (он блефует).
3. **Готовое API ядра под будущий UI.** `TableContext` принимает `opponents[]` и `activeOpponentIndex`; это можно вызывать из тестов и будущего UI без изменений.
4. **Обратная совместимость.** Без профилей всё работает как раньше (60 тестов остаются зелёными).

## 3. Нецели

- **UI в этом релизе НЕ делаем.** Ввод профилей — отдельный PR. Сейчас только ядро: эквити + совет + пресеты как данные.
- Не делаем имплайд-оддсы, стеки, GTO-солвер.
- Не храним статистику между сессиями (без persistence).
- Не различаем рейз/колл оппонента в диапазоне (упрощённая модель: весь VPIP = диапазон).
- `apps/app` не редактируется.

## 4. Архитектура

Используется существующая слоистая структура v1.3.0. Изменения **только в `packages/core`**:

```
packages/core/src/
├── config/
│   ├── player-presets.ts    НОВЫЙ: 5 типов игроков (Нит/TAG/LAG/Фиш/Маньяк)
│   ├── thresholds.ts        MODIFY: добавить PFR-модификаторы порогов
│   └── (hand-rankings, vpip-ranges — без изменений)
├── players/
│   ├── ranges.ts            MODIFY: полная statsToRange (сейчас заглушка)
│   └── (profiles.ts — без изменений)
├── equity/
│   └── equity.ts            MODIFY: Монте-Карло с диапазонами оппонентов
├── strategy/
│   └── advice.ts            MODIFY: модификатор порогов по PFR активного оппонента
├── types.ts                 MODIFY: TableContext — добавить activeOpponentIndex?
└── index.ts                 MODIFY: экспорт новых типов/функций

apps/app/src/app.ts — НЕ ТРОГАЕМ (UI в отдельном релизе)
```

### 4.1. Data flow (API, без UI)

```
Тесты / будущий UI
  └─ getAdvice({ ..., opponents, activeOpponentIndex })
     ├─ equityPercentRange(holeCards, board, numPlayers-1, iter, opponents)
     │   └─ Монте-Карло: оппонентам с stats → карты из statsToRange(stats)
     │                              без stats → случайные из колоды
     ├─ модификатор порога: PFR активного оппонента → foldBarPct *= factor
     └─ совет с учётом модифицированного порога
```

## 5. Детали модулей

### 5.1. `config/player-presets.ts` (НОВЫЙ)

5 предустановленных типов игроков с типичными VPIP/PFR. Значения — стандартные оценки из покерной литературы.

```ts
export type PlayerPresetKey = 'nit' | 'tag' | 'lag' | 'fish' | 'maniac';

export interface PlayerPreset {
  key: PlayerPresetKey;
  label: string;        // для UI
  description: string;  // краткое описание стиля
  vpip: number;
  pfr: number;
}

export const PLAYER_PRESETS: readonly PlayerPreset[] = [
  { key: 'unknown', label: 'Неизвестен', description: 'Случайная рука', vpip: 0, pfr: 0 },
  { key: 'nit', label: 'Нит', description: 'Тайтовый-пассивный, играет только премиум', vpip: 12, pfr: 10 },
  { key: 'tag', label: 'TAG', description: 'Тайтовый-агрессивный, оптимальный стиль', vpip: 22, pfr: 18 },
  { key: 'lag', label: 'LAG', description: 'Лузовый-агрессивный, много рейзов', vpip: 35, pfr: 28 },
  { key: 'fish', label: 'Фиш', description: 'Лузовый-пассивный, коллирует всё', vpip: 50, pfr: 8 },
  { key: 'maniac', label: 'Маньяк', description: 'Сверхагрессивный, блефует много', vpip: 60, pfr: 45 },
] as const;

export function getPreset(key: PlayerPresetKey | 'unknown'): PlayerPreset {
  return PLAYER_PRESETS.find(p => p.key === key) ?? PLAYER_PRESETS[0];
}
```

### 5.2. `players/ranges.ts` (MODIFY — полная реализация)

Заглушка из v1.3.0 становится полной. Функция `statsToRange` уже работает (интерполяция VPIP → % → topPercentHands), но добавляется валидация и обработка краёв.

```ts
/**
 * Перевод метрик игрока в диапазон рук.
 * Интерполяция % диапазона по VPIP между узлами VPIP_RANGE_NODES,
 * затем топ-N% из 169 рук (hand-rankings.ts).
 * При vpip<=0 (неизвестный игрок) возвращает пустой массив = вся колода.
 */
export function statsToRange(stats: PlayerStats): readonly string[] {
  if (stats.vpip <= 0) return []; // unknown → случайная рука
  const rangePct = interpolateVpipToRange(clamp(stats.vpip, 0, 100));
  return topPercentHands(rangePct);
}
```

Ключевое: `vpip <= 0` → пустой массив → в equity это сигнализирует «случайная рука из колоды».

### 5.3. `equity/equity.ts` (MODIFY — Монте-Карло с диапазонами)

Сигнатура `equity` расширяется опциональным параметром `opponents`:

```ts
export function equity(
  holeCards: Card[],
  board: Card[],
  numOpponents: number = 1,
  iterations: number = DEFAULT_ITERATIONS,
  opponents?: Opponent[],   // НОВОЕ
): { win: number; tie: number; lose: number; total: number }
```

Логика раздачи карт оппонентам (внутри цикла Монте-Карло):
- Если `opponents` не передан или короче `numOpponents` — все оппоненты случайные (обратная совместимость).
- Для оппонента `o` с `stats` (vpip > 0): вычислить `range = statsToRange(stats)` один раз (перед циклом), затем в каждой итерации взять 2 случайные карты из `range`, не пересекающиеся с уже розданными.
- Для оппонента без `stats`: 2 случайные карты из оставшейся колоды (как сейчас).

**Сложный момент — раздача из диапазона без конфликтов.** Подход: на каждой итерации фильтровать `range` оппонента, убирая уже использованные карты (наш hand + board + карты предыдущих оппонентов), затем shuffle + взять 2. Если в диапазоне осталось <2 карт (редкий случай — диапазон узкий + много карт на столе) — fallback к случайной руке.

`equityPercent` и `equityPercentRange` получают тот же опциональный параметр `opponents` и пробрасывают его в `equity`.

### 5.4. `config/thresholds.ts` (MODIFY — PFR-модификаторы)

Добавляются коэффициенты модификации порога фолда по PFR активного оппонента:

```ts
/**
 * Модификатор порога фолда по агрессивности активного оппонента (PFR).
 * Низкий PFR (нит-рейз ~10) → его ставка весомее → фолд шире → множитель > 1.
 * Высокий PFR (маньяк ~45) → он блефует → колл шире → множитель < 1.
 * Базовый PFR (TAG ~20) → множитель = 1 (без изменения).
 *
 * Формула: factor = 1 + (BASE_PFR - opponentPfr) * SENSITIVITY
 * Клиппинг в [MIN, MAX].
 */
export const PFR_BASE = 18;          // PFR TAG — нейтральная точка, при которой порог не меняется
export const PFR_MODIFIER_SENSITIVITY = 0.015; // на сколько менять множитель за 1% PFR
export const PFR_MODIFIER_MIN = 0.8;  // маньяк → порог ×0.8 (колл шире)
export const PFR_MODIFIER_MAX = 1.3;  // нит → порог ×1.3 (фолд шире)
```

Эти числа калибруются по принципу: нит с PFR=10 даёт множитель 1.15 (порог 22→25%), маньяк с PFR=45 даёт 0.88. Разумный диапазон влияния без перекоса советов.

### 5.5. `strategy/advice.ts` (MODIFY — модификатор порогов)

`getAdvice` использует PFR активного оппонента для модификации `foldBarPct` и связанных порогов.

«Активный оппонент» = `opponents[activeOpponentIndex]` при `toCall > 0`. Если `activeOpponentIndex` не задан или у оппонента нет `stats` — модификатор = 1 (без изменения).

```ts
// В начале getAdvice, после расчёта latePos:
const activeOpp = ctx.opponents?.[ctx.activeOpponentIndex ?? -1];
const activePfr = activeOpp?.stats && activeOpp.stats.pfr > 0 ? activeOpp.stats.pfr : PFR_BASE;
const pfrModifier = clamp(
  1 + (PFR_BASE - activePfr) * PFR_MODIFIER_SENSITIVITY,
  PFR_MODIFIER_MIN,
  PFR_MODIFIER_MAX,
);
// Дальше: foldBarPct *= pfrModifier (и аналогично для related порогов)
```

В reason совета добавляется заметка при `pfrModifier !== 1`:
- `pfrModifier > 1.05`: «Против тайтового оппонента (PFR ~{pfr}%) его ставка весомее — фолд оправданнее.»
- `pfrModifier < 0.95`: «Против агрессивного оппонента (PFR ~{pfr}%) можно коллить шире — он часто блефует.»

### 5.6. `types.ts` (MODIFY — TableContext)

```ts
export interface TableContext {
  // ... существующие поля ...
  opponents?: Opponent[];          // уже есть (v1.3)
  activeOpponentIndex?: number;    // НОВОЕ: индекс в opponents[] для активного оппонента (ставщика)
}
```

### 5.7. API-контракт для будущего UI (без реализации UI)

Ядро предоставляет готовый контракт; будущий UI лишь собирает `opponents[]` из полей и вызывает `getAdvice`. Контракт:

```ts
// Будущий UI собирает:
const opponents: Opponent[] = [
  { position: 1, stats: { vpip: 22, pfr: 18 } }, // SB с профилем TAG
  { position: 3 },                                // UTG без профиля (случайная рука)
];
const activeOpponentIndex = 0; // SB — ставщик

// Вызов ядра (без изменений в сигнатуре, кроме опциональных полей):
getAdvice({ ..., opponents, activeOpponentIndex });
```

UI в этом релизе НЕ пишется — это отдельный PR. Сейчас всё проверяется unit-тестами.

## 6. Активный оппонент (контракт)

Активный оппонент = `opponents[activeOpponentIndex]` при `toCall > 0`. Если `activeOpponentIndex` не задан, выходит за границы, или у оппонента нет `stats` — модификатор = 1 (без изменений, поведение как без профилей). В будущем UI пользователь отметит «поставил» явно; сейчас это индекс в массиве, задаётся в тестах напрямую.

## 7. План миграции (поэтапный)

Каждый шаг — TDD, после каждого полный прогон тестов.

1. `config/player-presets.ts` + тесты (5 типов).
2. `players/ranges.ts` — полная `statsToRange` (vpip<=0 → пусто) + тесты.
3. `equity/equity.ts` — Монте-Карло с диапазонами + тесты (эквити против нита vs маньяка отличается).
4. `config/thresholds.ts` — PFR-модификаторы + `types.ts` activeOpponentIndex.
5. `strategy/advice.ts` — модификатор порогов + заметки в reason + тесты.
6. `index.ts` — экспорт пресетов/модификаторов.
7. Bump до v1.4.0, финальная сборка.

**UI (`app.ts`) — отдельный релиз, здесь не трогаем.**

## 8. Тесты

- **Новые unit-тесты core:**
  - `config/player-presets.test.ts` — 5 типов, метрики в диапазоне 0-100.
  - `players/ranges.test.ts` — `statsToRange` для нит/маньяк, `vpip<=0 → []`.
  - `equity/equity.test.ts` — эквити AA vs нит-диапазон > эквити AA vs случайные; эквити vs маньяк ≈ эквити vs случайные (его диапазон широк).
  - `strategy/advice.test.ts` — при том же board/toCall, совет против нита (PFR 10) даёт fold там, где против маньяка (PFR 45) даёт call.
- **Существующие 60 тестов остаются зелёными** (без opponents всё работает как раньше).

## 9. Риски и митигация

| Риск | Митигация |
|------|-----------|
| Монте-Карло с диапазонами медленнее (фильтр range каждую итерацию) | Кешировать range до цикла; fallback к случайной при <2 карт |
| Диапазон из топ-N% неточно отражает реальные руки оппонента | Документировать как упрощённую модель; пресеты калибруемы в config |
| Фича без UI «невидима» пользователю | Это подготовка ядра; UI следующим PR. Покрытие unit-тестами подтверждает работу |

## 10. Критерий готовности

- [ ] `statsToRange` полная (vpip<=0 → пусто)
- [ ] Эквити против диапазонов работает (AA vs нит > vs случайные)
- [ ] Совет модифицируется по PFR активного оппонента
- [ ] API-контракт готов под будущий UI (`opponents`, `activeOpponentIndex`)
- [ ] 60 существующих + ~10 новых тестов зелёные
- [ ] Без профилей всё работает как раньше
- [ ] `apps/app` не изменён
- [ ] Bump до v1.4.0
