# Рефакторинг @poker/core: слоистая архитектура, вынос конфигов, задел под профили игроков

**Дата:** 2026-07-06
**Ветка:** `release/v1.2` (продолжение)
**Целевая версия:** v1.3.0
**Предыдущий релиз:** v1.2.0 (фиксы багов математики, итерации Монте-Карло, маргинальные решения, натс на флопе)

---

## 1. Контекст и мотивация

`packages/core/src/` — единая папка из 16 файлов (840 строк кода), где оценка рук, эквити, ауты, советы и позиции лежат вперемешку. Магические числа (пороги fold/call, премиум-руки, итерации Монте-Карло, скидки за позицию) разбросаны по телам функций — см. перечень в §4.1.

Документ `docs/STRATEGY_ALIGNMENT.md` фиксирует эти допущения текстом, но связь с кодом не формальная — числа в коде, текст в документе, и они уже расходятся.

**Дополнительная мотивация — будущая фича профилей игроков.** Запланирована фича: пользователь задаёт каждому оппоненту VPIP/PFR (числовые метрики лузовости/агрессивности), и советы + эквити считаются с учётом диапазонов оппонентов. Текущая архитектура к этому не готова: эквити знает только `numPlayers`, `TableContext` не различает оппонентов, конфигов для диапазонов нет. Рефактор закладывает структуру, чтобы фича добавилась одним PR без перестройки.

Два известных бага (эквити против N оппонентов завышен, валидация карт отсутствует) чинятся **после** рефактора, в новой структуре — отдельной задачей.

## 2. Цели

1. **Тестируемость и фиксация стратегии.** Все магические числа переезжают в явные конфиг-модули. Стратегия видна и проверяема в одном месте.
2. **Изоляция математики.** Чистые вычисления (оценка рук, эквити) отделены от оркестрации (advice) — можно оптимизировать/кешировать/вынести в Web Worker независимо.
3. **Заложить фундамент под профили игроков.** Структура слоёв, типы и данные (169 рук Sklansky, узлы VPIP) готовятся сейчас, чтобы фича добавилась позже без перестройки. Сама фича **не реализуется** в этом рефакторе.
4. **Сохранение поведения.** Рефактор **не меняет** вывода ни одной существующей функции. Все 40 существующих тестов остаются зелёными (переносятся к новым модулям).

## 3. Нецели

- Не реализуем фичу профилей игроков (эквити против диапазонов, модификаторы совета по профилю) — отдельный PR после.
- Не чиним баги в этом рефакторе (эквити vs N оппонентов, валидация карт) — отдельная задача после.
- Не добавляем имплайд-оддсы, калибровку confidence.
- Не меняем публичный API — `app.ts` не редактируется (единственное исключение: §7 шаг 9, где хардкод итераций заменяется на константы из `config/simulation.ts`; публичный API `@poker/core` не меняется).
- Не оптимизируем производительность — только перегруппировка.

## 4. Архитектура

### 4.1. Целевая структура

```
packages/core/src/
├── config/                  ← ВСЕ числа, данные и стратегические допущения
│   ├── thresholds.ts            пороги fold/call, скидки за позицию, confidence
│   ├── preflop.ts               премиум-руки (AA–JJ), бродвей
│   ├── simulation.ts            итерации Монте-Карло
│   ├── hand-rankings.ts    НОВЫЙ: список 169 стартовых рук по Sklansky (данные)
│   └── vpip-ranges.ts      НОВЫЙ: узлы VPIP → % диапазона (данные)
├── players/                 ← НОВЫЙ СЛОЙ: модель оппонента (типы + задел под логику)
│   ├── profiles.ts              тип PlayerStats (VPIP/PFR), raiseFactor
│   └── ranges.ts                заглушка statsToRange (реализация — в фиче)
├── eval/                    ← чистая математика комбинаций (без решений)
│   ├── deck.ts
│   ├── hand-eval.ts
│   └── nuts.ts
├── equity/                  ← вероятности
│   ├── equity.ts                сигнатура готова к opponents?: PlayerStats[]
│   └── outs.ts
├── strategy/                ← оркестрация: советы, позиции
│   ├── advice.ts                TableContext готов к opponents[]
│   └── positions.ts
├── types.ts                 ← общие типы
├── validation.ts            ← НОВЫЙ: проверка карт (реализация — в задаче по багу #2)
└── index.ts                 ← фасад
```

### 4.2. Правило зависимостей

Слои зависят **только вниз**. Циклы запрещены.

```
config/      → (ничего, только types.ts)
players/     → config/, types.ts
eval/        → config/, types.ts
equity/      → eval/, config/, players/, types.ts
strategy/    → equity/, eval/, config/, players/, types.ts
index.ts     → всё (фасад)
```

Тестовый файл `layer-deps.test.ts` (добавляется) статически проверяет отсутствие обратных зависимостей через анализ `import` в каждом файле.

### 4.3. Соответствие STRATEGY_ALIGNMENT.md

| Секция документа | Модуль |
|------------------|--------|
| §1 Пот-оддсы | `strategy/advice.ts` (формула) + `config/thresholds.ts` (пороги) |
| §2 Монте-Карло | `equity/equity.ts` + `config/simulation.ts` |
| §3 Rule of 2/4 | `equity/outs.ts` |
| §4 Позиция | `strategy/positions.ts` + `config/thresholds.ts` (скидки) |
| §5 Премиум-руки | `config/preflop.ts` |
| §6 Натс | `eval/nuts.ts` |
| §7 Дро + пот-оддсы | `strategy/advice.ts` + `equity/outs.ts` |
| (новое) Профили игроков | `players/` + `config/hand-rankings.ts` + `config/vpip-ranges.ts` |

## 5. Детали модулей

### 5.1. `config/thresholds.ts`

Все пороги и коэффициенты из текущего `advice.ts`. Экспортирует именованные константы:

```ts
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

// Порог колла на грани
export const CALL_THRESHOLD_EARLY_PCT = 0;
export const CALL_THRESHOLD_LATE_PCT = -5;

// Confidence для каждого типа совета
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

### 5.2. `config/preflop.ts`

Из `advice.ts:20-36`:

```ts
export const PREMIUM_PAIR_MIN_RANK = 9;   // J=9 → AA, KK, QQ, JJ
export const BROADWAY_MIN_RANK = 8;       // T=8 → T, J, Q, K, A
```

Функции `isPremiumPocketPair`, `isPreflopNeverFoldWeak` остаются в `strategy/advice.ts` (они — логика), импортируют константы отсюда.

### 5.3. `config/simulation.ts`

```ts
export const DEFAULT_ITERATIONS = 2000;
export const PREFLOP_ITERATIONS = 3000;
export const POSTFLOP_ITERATIONS = 2000;
```

`app.ts:828` (`board.length === 0 ? 3000 : 2000`) после рефактора читает эти константы.

### 5.4. `config/hand-rankings.ts` (НОВЫЙ — данные для фичи профилей)

Список 169 стартовых рук, упорядоченных по Sklansky/стандартному покерному ранжированию. Только данные, без логики.

```ts
/** 169 стартовых рук, упорядоченные по силе (Sklansky-style ranking). */
export const HAND_RANKINGS: readonly string[] = [
  'AA', 'KK', 'QQ', 'AKs', 'JJ', 'AQs', 'KQs', 'AJs', 'KTs', 'TT',
  'AKo', 'KJs', 'ATs', 'QJs', 'JTs', 'QTs', '99', 'AQo', 'A9s', 'KTs',
  // ... полный список 169 рук по убыванию силы
  // Формат: пара (AA/KK/...), suited (AKs/QJs/...), offsuit (AKo/QJo/...)
] as const;

/** Топ-N% рук как массив строковых кодов. N=20 → первые ~34 руки. */
export function topPercentHands(pct: number): readonly string[] {
  const count = Math.round((pct / 100) * 169);
  return HAND_RANKINGS.slice(0, count);
}
```

Полный список 169 рук заполняется по опубликованному ранжированию (Sklansky «Theory of Poker» / стандартные чарты). Источник фиксируется в комментарии файла.

### 5.5. `config/vpip-ranges.ts` (НОВЫЙ — данные для фичи профилей)

Узлы для интерполяции VPIP → % диапазона рук.

```ts
/** Узлы интерполяции: VPIP → процент рук, которые игрок обычно разыгрывает. */
export const VPIP_RANGE_NODES: readonly { vpip: number; rangePct: number }[] = [
  { vpip: 10, rangePct: 15 },   // нит: топ-15%
  { vpip: 20, rangePct: 25 },   // TAG
  { vpip: 35, rangePct: 45 },   // LAG
  { vpip: 55, rangePct: 65 },   // фиш
] as const;
```

Числа узлов — настраиваемые оценки, источник фиксируется в комментарии.

### 5.6. `players/profiles.ts` (НОВЫЙ)

Типы модели оппонента.

```ts
/** Числовые метрики оппонента. */
export interface PlayerStats {
  /** VPIP — добровольно вложенные деньги на префлопе, 0..100. Мера лузовости. */
  vpip: number;
  /** PFR — префлоп-рейз, 0..100. Мера агрессии на префлопе. */
  pfr: number;
}

/** Один оппонент за столом с его статистикой. */
export interface Opponent {
  /** Позиция за столом (тот же индекс, что в positions.ts). */
  position: number;
  /** Метрики, если известны. undefined = неизвестный оппонент (случайная рука). */
  stats?: PlayerStats;
}

/**
 * Агрессивность как отношение PFR/VPIP (raise factor).
 * Высокое значение = игрок чаще открывается рейзом, а не коллом.
 * При VPIP=0 возвращает 0 (нет данных).
 */
export function raiseFactor(stats: PlayerStats): number {
  if (stats.vpip <= 0) return 0;
  return stats.pfr / stats.vpip;
}
```

### 5.7. `players/ranges.ts` (НОВЫЙ — заглушка)

```ts
import type { PlayerStats } from './profiles';
import { VPIP_RANGE_NODES } from '../config/vpip-ranges';
import { topPercentHands } from '../config/hand-rankings';

/**
 * Перевод метрик игрока в диапазон рук.
 * Реализация: линейная интерполяция % диапазона по VPIP, затем топ-N% из 169 рук.
 *
 * ВНИМАНИЕ: заглушка для рефактора. Полная реализация (с учётом PFR для сужения
 * рейз-диапазона, обработка краёв) — в фиче профилей игроков.
 */
export function statsToRange(stats: PlayerStats): readonly string[] {
  const rangePct = interpolateVpipToRange(stats.vpip);
  return topPercentHands(rangePct);
}

/** Линейная интерполяция между узлами VPIP_RANGE_NODES. */
function interpolateVpipToRange(vpip: number): number {
  // реализация интерполяции
  // ...
}
```

### 5.8. Слои `eval/`, `equity/`, `strategy/`

Переносятся **как есть**, меняются только пути импортов. Внутренняя логика функций не правится.

`eval/deck.ts` ← `deck.ts` (без изменений)
`eval/hand-eval.ts` ← `hand-eval.ts` (импорт `../types`)
`eval/nuts.ts` ← `nuts.ts` (импорт `./hand-eval`, `./deck`, `../types`)
`equity/equity.ts` ← `equity.ts` (импорт `../eval/deck`, `../eval/hand-eval`, `../types`, `../config/simulation`)
`equity/outs.ts` ← `outs.ts` (импорт `../eval/deck`, `../types`)
`strategy/advice.ts` ← `advice.ts` (импорт `../equity/equity`, `../eval/hand-eval`, `../equity/outs`, `../eval/nuts`, `./positions`, `../config/thresholds`, `../config/preflop`, `../types`)
`strategy/positions.ts` ← `positions.ts` (без изменений)

**Точка расширения для фичи** (но не реализация): сигнатура `equity()` и тип `TableContext` в core получают опциональные поля `opponents`/`opponentStats`. В v1.3 эти поля добавляются в типы, но **не используются** в логике — если не переданы, функции работают идентично текущему поведению. `app.ts` эти поля не передаёт (ему нечего передавать до UI фичи), поэтому остаётся без изменений. Реальное использование диапазонов в `equity()` и `advice.ts` — в фиче профилей. См. §6.

## 6. Задел под фичу профилей (что делается сейчас vs. потом)

| Элемент | Сейчас (рефактор v1.3) | Потом (фича профилей) |
|---------|:---:|:---:|
| Слой `players/` (папка) | ✅ создаётся | — |
| `PlayerStats`, `Opponent` типы | ✅ в `players/profiles.ts` | — |
| `raiseFactor(stats)` | ✅ простая функция | — |
| `config/hand-rankings.ts` (169 рук) | ✅ данные | — |
| `config/vpip-ranges.ts` (узлы) | ✅ данные | — |
| `statsToRange()` полная реализация | ⛔ заглушка | ✅ |
| `equity()` с диапазонами оппонентов | ⛔ сигнатура готова, работает как раньше | ✅ Монте-Карло против диапазонов |
| `TableContext.opponents` | ⛔ опц. поле, игнорируется | ✅ учитывается в `getAdvice` |
| Модификаторы совета по профилю | ⛔ | ✅ в `config/thresholds.ts` + `advice.ts` |
| UI ввода VPIP/PFR | ⛔ | ✅ в `app.ts` |

**Гарантия обратной совместимости:** если `opponents`/`opponentStats` не переданы (что в v1.3 всегда), все функции работают идентично текущему поведению. 40 тестов подтверждают.

## 7. План миграции (поэтапный)

Рефактор выполняется серией малых шагов, после каждого — полный прогон тестов. Если на любом шаге тесты красные — фиксим до перехода к следующему.

1. **Создать `config/`** (5 файлов: thresholds, preflop, simulation, hand-rankings, vpip-ranges). Компиляция проходит, тестов к чистым данным пока нет.
2. **Перенести `types.ts`** — остаётся в корне `src/` (общий для всех слоёв).
3. **Создать `players/`** — `profiles.ts` (типы + `raiseFactor`), `ranges.ts` (заглушка `statsToRange`). Компиляция проходит.
4. **Создать `eval/`** — перенести `deck.ts`, `hand-eval.ts`, `nuts.ts` + их тесты. Обновить импорты. Тесты зелёные.
5. **Создать `equity/`** — перенести `equity.ts`, `outs.ts` + тесты. Импорты из `../eval/` и `../config/`. Тесты зелёные.
6. **Создать `strategy/`** — перенести `advice.ts`, `positions.ts` + тесты. `advice.ts` импортирует константы из `config/`. Тесты зелёные.
7. **Обновить `index.ts`** — пути импортов на подпапки. Состав экспортов **не меняется**. Экспортируются новые типы `PlayerStats`, `Opponent`.
8. **Удалить старые файлы** из корня `src/`. Компиляция и тесты зелёные.
9. **Обновить `app.ts:828`** — `PREFLOP_ITERATIONS`/`POSTFLOP_ITERATIONS` из `config/simulation` вместо хардкода.
10. **Тест слоёв** (`layer-deps.test.ts`) — проверка отсутствия обратных зависимостей.
11. **Сборка `npm run build`** + полный прогон всех 40 тестов.

## 8. Тесты

- **Перенос:** 40 существующих тестов переезжают рядом со своими модулями (состав и ассерты не меняются, меняется только папка):
  - `regressions.test.ts`, `marginal.test.ts`, `advice.test.ts` → `strategy/`
  - `equity.test.ts`, `outs.test.ts` → `equity/`
  - `nuts.test.ts` → `eval/`
  - `positions.test.ts` → `strategy/`
- **Новые тесты:**
  - `layer-deps.test.ts` (в корне `src/`) — статически проверяет отсутствие обратных зависимостей между слоями.
  - `config/hand-rankings.test.ts` — `HAND_RANKINGS` содержит 169 уникальных рук; `topPercentHands(20)` возвращает ~34 руки.
  - `config/vpip-ranges.test.ts` — узлы упорядочены по VPIP, `rangePct` монотонно.
  - `players/profiles.test.ts` — `raiseFactor` для типичных профилей (нит/LAG/маньяк).
- **Критерий успеха:** 40 перенесённых + 4 новых = 44 теста, все зелёные. `npm run build` без ошибок.

## 9. Риски и митигация

| Риск | Митигация |
|------|-----------|
| Пропущен импорт после переезда → runtime-ошибка | После каждого шага полный прогон тестов; сборка проверяет типы |
| Нарушено правило зависимостей (цикл) | `layer-deps.test.ts` ловит на CI |
| `app.ts` или e2e ломаются от изменения путей | Фасад `index.ts` сохраняет состав экспортов |
| Данные `hand-rankings.ts`/`vpip-ranges.ts` некорректны | Тесты на количество/уникальность/монотонность; источник фиксируется в комментариях |
| Рассинхрон `config/` с `STRATEGY_ALIGNMENT.md` | После рефактора — отдельная задача обновить документ под актуальные числа |

## 10. Что НЕ входит (отложено)

- **Фича профилей игроков** — полная реализация `statsToRange`, эквити против диапазонов, модификаторы совета, UI ввода.
- **Баг #1: эквити против N оппонентов завышен** — фикс в `equity/equity.ts` после рефактора.
- **Баг #2: валидация карт** — новый `src/validation.ts` после рефактора.
- **Имплайд-оддсы, диапазоны, калибровка confidence** — будущие релизы.
- **Web Worker для equity** — будущая оптимизация, архитектура к этому готовит.
- **Обновление `STRATEGY_ALIGNMENT.md`** — после фикса багов.

## 11. Критерий готовности

- [ ] Структура папок соответствует §4.1
- [ ] Все импорты обновлены, циклов нет (подтверждено `layer-deps.test.ts`)
- [ ] 40 перенесённых тестов + 4 новых = 44 зелёных
- [ ] `npm run build` без ошибок (CJS + ESM + DTS)
- [ ] `app.ts` компилируется (импорт из `@poker/core` работает)
- [ ] Вывод ни одной существующей функции не изменился (тесты подтверждают)
- [ ] Созданы `players/`, `config/hand-rankings.ts`, `config/vpip-ranges.ts` (задел под фичу)
