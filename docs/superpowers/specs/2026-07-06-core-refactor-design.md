# Рефакторинг @poker/core: слоистая архитектура и вынос конфигов

**Дата:** 2026-07-06
**Ветка:** `release/v1.2` (продолжение)
**Целевая версия:** v1.3.0
**Предыдущий релиз:** v1.2.0 (фиксы багов математики, итерации Монте-Карло, маргинальные решения, натс на флопе)

---

## 1. Контекст и мотивация

`packages/core/src/` — единая папка из 16 файлов (840 строк кода), где оценка рук, эквити, ауты, советы и позиции лежат вперемешку. Магические числа (пороги fold/call, премиум-руки, итерации Монте-Карло, скидки за позицию) разбросаны по телам функций:

- `advice.ts:23` — `r >= 9` (J и выше = премиум-пара)
- `advice.ts:35` — `r0 >= 8 && r1 >= 8` (бродвей)
- `advice.ts:76,85,94,104,...` — `confidence: 0.95 / 0.9 / 0.8 / 0.7 / 0.65 / 0.6 / 0.55 / 0.5 / 0.4`
- `advice.ts:111` — `Math.max(requiredEquityPct * 1.15, latePos ? 14 : 22)` (порог фолда)
- `advice.ts:134` — `latePos ? 1.05 : 1.1` (запас эквити для фолда)
- `advice.ts:158` — `latePos ? 30 : 35` (минимум эквити без пот-оддсов)
- `advice.ts:194` — `latePos ? -5 : 0` (порог колла)
- `equity.ts:32,85,96` — `iterations: 2000` (Монте-Карло)
- `app.ts:828` — `board.length === 0 ? 3000 : 2000`

Документ `docs/STRATEGY_ALIGNMENT.md` фиксирует эти допущения текстом, но связь с кодом не формальная — числа живут в коде, текст в документе, и они могут рассинхронизироваться (уже расходятся: документ упоминает старые пороги).

Два известных бага (эквити против N оппонентов завышен, валидация карт отсутствует) будут чиниться **после** рефактора, в новой структуре — это отдельная задача.

## 2. Цели

1. **Тестируемость и фиксация стратегии.** Все магические числа переезжают в явные конфиг-модули. Стратегия видна и проверяема в одном месте.
2. **Изоляция математики.** Чистые вычисления (оценка рук, эквити) отделены от оркестрации (advice) — можно оптимизировать/кешировать/Web-Worker-ифицировать независимо.
3. **Сохранение поведения.** Рефактор **не меняет** вывода ни одной функции. Все 40 существующих тестов остаются зелёными (переносятся к новым модулям).

## 3. Нецели

- Не чиним баги в этом рефакторе (эквити vs N оппонентов, валидация карт) — отдельная задача после.
- Не добавляем имплайд-оддсы, диапазоны оппонентов, калибровку confidence.
- Не меняем публичный API — `app.ts` не редактируется (единственное исключение: §6 шаг 9, где хардкод `3000/2000` заменяется на константы из `config/simulation.ts`; публичный API `@poker/core` при этом не меняется).
- Не оптимизируем производительность (7-card evaluator и т.д.) — только перегруппировка.

## 4. Архитектура

### 4.1. Целевая структура

```
packages/core/src/
├── config/                  ← ВСЕ магические числа и стратегические допущения
│   ├── thresholds.ts            пороги fold/call, скидки за позицию, confidence
│   ├── preflop.ts               премиум-руки (AA–JJ), бродвей
│   └── simulation.ts            итерации Монте-Карло
├── eval/                    ← чистая математика комбинаций (без решений)
│   ├── deck.ts                  createDeck, shuffle, fillRemaining, removeKnown
│   ├── hand-eval.ts             evaluateHand, evaluatePlayerHand, compareHands
│   └── nuts.ts                  getNuts, compareToNuts
├── equity/                  ← вероятности (Монте-Карло, ауты)
│   ├── equity.ts                equity, equityPercent, equityPercentRange
│   └── outs.ts                  countOuts, totalOuts
├── strategy/                ← оркестрация: советы, позиции
│   ├── advice.ts                getAdvice
│   └── positions.ts             позиции, isLatePosition
├── types.ts                 ← общие типы (без изменений по составу)
└── index.ts                 ← фасад (без изменений по составу экспортов)
```

### 4.2. Правило зависимостей

Слои зависят **только вниз**. Циклы запрещены.

```
config/      → (ничего, только types.ts)
eval/        → config/, types.ts
equity/      → eval/, config/, types.ts
strategy/    → equity/, eval/, config/, types.ts
index.ts     → всё (фасад)
```

Тестовый файл `layer-deps.test.ts` (добавляется) проверяет отсутствие обратных зависимостей через статический анализ `import` в каждом файле.

### 4.3. Соответствие STRATEGY_ALIGNMENT.md

Каждая секция документа отображается на модуль:

| Секция документа | Модуль |
|------------------|--------|
| §1 Пот-оддсы | `strategy/advice.ts` (формула) + `config/thresholds.ts` (пороги) |
| §2 Монте-Карло | `equity/equity.ts` + `config/simulation.ts` |
| §3 Rule of 2/4 | `equity/outs.ts` |
| §4 Позиция | `strategy/positions.ts` + `config/thresholds.ts` (скидки) |
| §5 Премиум-руки | `config/preflop.ts` |
| §6 Натс | `eval/nuts.ts` |
| §7 Дро + пот-оддсы | `strategy/advice.ts` + `equity/outs.ts` |

## 5. Детали модулей

### 5.1. `config/thresholds.ts`

Все пороги и коэффициенты из `advice.ts`. Экспортирует именованные константы:

```ts
// Порог фолда: max(requiredEquity * множитель, абсолютный минимум)
export const FOLD_EQUITY_MULTIPLIER = 1.15;
export const FOLD_BAR_EARLY_PCT = 22;     // без позиции
export const FOLD_BAR_LATE_PCT = 14;      // поздняя позиция

// Запас эквити для решения «эквити ниже требуемой → фолд»
export const LOW_EQ_FOLD_MARGIN_EARLY = 1.1;
export const LOW_EQ_FOLD_MARGIN_LATE = 1.05;

// Колл без пот-оддсов (банк не указан)
export const MIN_EQ_NO_POTODDS_EARLY_PCT = 35;
export const MIN_EQ_NO_POTODDS_LATE_PCT = 30;
export const STRONG_EQ_NO_POTODDS_PCT = 50; // уверенный колл

// Маржа эквити над требуемой для уверенного колла
export const CALL_MARGIN_STRONG_PCT = 25;   // «колл выгоден»
export const CALL_MARGIN_OK_PCT = 10;       // «колл допустим»

// Порог колла на грани (отрицательный = допускаем небольшой минус)
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

Из `advice.ts:20-36`. Премиум-пары и бродвей:

```ts
export const PREMIUM_PAIR_MIN_RANK = 9;   // J=9 → AA, KK, QQ, JJ
export const BROADWAY_MIN_RANK = 8;       // T=8 → T, J, Q, K, A
```

Функции `isPremiumPocketPair`, `isPreflopNeverFoldWeak` переезжают в `strategy/advice.ts` (они логика, не конфиг) и импортируют константы отсюда.

### 5.3. `config/simulation.ts`

```ts
export const DEFAULT_ITERATIONS = 2000;
export const PREFLOP_ITERATIONS = 3000;   // больше карт неизвестно → выше дисперсия
export const POSTFLOP_ITERATIONS = 2000;
```

`app.ts:828` (`board.length === 0 ? 3000 : 2000`) после рефактора читает эти константы.

### 5.4. Слои `eval/`, `equity/`, `strategy/`

Переносятся **как есть**, меняются только пути импортов. Внутренняя логика функций не правится.

`eval/deck.ts` ← `deck.ts` (без изменений)
`eval/hand-eval.ts` ← `hand-eval.ts` (импорт types.ts через `../types`)
`eval/nuts.ts` ← `nuts.ts` (импорт `./hand-eval`, `./deck`, `../types`)
`equity/equity.ts` ← `equity.ts` (импорт `../eval/deck`, `../eval/hand-eval`, `../types`, `../config/simulation`)
`equity/outs.ts` ← `outs.ts` (импорт `../eval/deck`, `../types`)
`strategy/advice.ts` ← `advice.ts` (импорт `../equity/equity`, `../eval/hand-eval`, `../equity/outs`, `../eval/nuts`, `./positions`, `../config/thresholds`, `../config/preflop`, `../types`)
`strategy/positions.ts` ← `positions.ts` (без изменений)

## 6. План миграции (поэтапный)

Рефактор выполняется серией малых шагов, после каждого — полный прогон тестов. Если на любом шаге тесты красные — фиксим до перехода к следующему.

1. **Создать `config/`** (3 файла). Тестов пока нет, компиляция проходит.
2. **Перенести `types.ts`** — остаётся в корне `src/` (общий для всех слоёв).
3. **Создать `eval/`** — перенести `deck.ts`, `hand-eval.ts`, `nuts.ts` + их тесты. Обновить импорты. Тесты зелёные.
4. **Создать `equity/`** — перенести `equity.ts`, `outs.ts` + тесты. Импорты теперь из `../eval/` и `../config/`. Тесты зелёные.
5. **Создать `strategy/`** — перенести `advice.ts`, `positions.ts` + тесты. `advice.ts` теперь импортирует константы из `config/`. Тесты зелёные.
6. **Обновить `index.ts`** — пути импортов меняются на подпапки. Состав экспортов **не меняется**.
7. **Удалить старые файлы** из корня `src/` (они продублированы в подпапках). Компиляция и тесты зелёные.
8. **Тест слоёв** (`layer-deps.test.ts`) — добавить проверку отсутствия обратных зависимостей.
9. **Обновить `app.ts:828`** — использовать `PREFLOP_ITERATIONS` / `POSTFLOP_ITERATIONS` из `config/simulation` вместо хардкода.
10. **Сборка `npm run build`** + полный прогон всех 40 тестов.

## 7. Тесты

- **Перенос:** все 40 существующих тестов переезжают рядом со своими модулями (конкретные имена файлов сохраняются, меняется только папка):
  - `regressions.test.ts`, `marginal.test.ts`, `advice.test.ts` → `strategy/`
  - `equity.test.ts` → `equity/`
  - `outs.test.ts` → `equity/`
  - `nuts.test.ts` → `eval/`
  - `positions.test.ts` → `strategy/`
- **Новый тест:** `layer-deps.test.ts` в корне `src/` — статически проверяет, что файлы в `config/` не импортируют из других слоёв, `eval/` не импортирует из `equity/`/`strategy/`, и т.д. Реализация — через чтение файлов и grep `import`-путей.
- **Критерий успеха:** 40 перенесённых + 1 новый = 41 тест, все зелёные. `npm run build` без ошибок.

## 8. Риски и митигация

| Риск | Митигация |
|------|-----------|
| Пропущен импорт после переезда → runtime-ошибка | После каждого шага полный прогон тестов; сборка проверяет типы |
| Нарушено правило зависимостей (цикл) | `layer-deps.test.ts` ловит на CI |
| `app.ts` или e2e ломаются от изменения путей | Фасад `index.ts` сохраняет состав экспортов; `app.ts` не редактируется (кроме строки 828) |
| Рассинхрон `config/thresholds.ts` с `STRATEGY_ALIGNMENT.md` | После рефактора — отдельная задача обновить документ под актуальные числа |

## 9. Что НЕ входит (отложено)

- **Баг #1: эквити против N оппонентов завышен** — фикс в `equity/equity.ts` после рефактора.
- **Баг #2: валидация карт (дубликаты, невалидные масти)** — новый `src/validation.ts` после рефактора.
- **Имплайд-оддсы, диапазоны, калибровка confidence** — будущие релизы.
- **Web Worker для equity** — будущая оптимизация, архитектура к этому готовит.
- **Обновление `STRATEGY_ALIGNMENT.md`** — после фикса багов, чтобы документ отражал финальное состояние.

## 10. Критерий готовности

- [ ] Структура папок соответствует §4.1
- [ ] Все импорты обновлены, циклов нет (подтверждено `layer-deps.test.ts`)
- [ ] 40 перенесённых тестов + 1 новый = 41 зелёный
- [ ] `npm run build` без ошибок (CJS + ESM + DTS)
- [ ] `app.ts` компилируется (импорт из `@poker/core` работает)
- [ ] Вывод ни одной функции не изменился (тесты подтверждают)
