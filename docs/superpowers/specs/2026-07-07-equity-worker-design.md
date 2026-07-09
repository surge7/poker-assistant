# Фича: Web Worker для расчёта эквити

**Дата:** 2026-07-07
**Ветка:** `main` (continuation)
**Целевая версия:** v1.6.0
**Предыдущий релиз:** v1.5.0 (имплайд-оддсы)

---

## 1. Контекст и мотивация

Расчёт эквити (Монте-Карло) синхронно блокирует UI:
- Автопересчёт (500 iter): ~200мс расчёт + 200мс дебаунс = ~400мс отклик — терпимо.
- **Ручной расчёт по кнопке (2000-3000 iter): 1.2-1.4 сек зависания UI** — главное торможение.

Во время расчёта UI полностью заморожен: анимации стопорятся, ввод не обрабатывается. Пользователь чувствует «зависание» особенно при нажатии «Рассчитать».

## 2. Цели

1. **Расчёт эквити в Web Worker** — отдельный поток, UI не блокируется.
2. **Полные итерации без ощущения тормоза** — кнопка «Рассчитать» использует 2000-3000 iter, но UI остаётся живым.
3. **Отмена устаревших расчётов** — если пользователь меняет карты пока предыдущий расчёт идёт, старый результат не показывается.
4. **Loading-индикация** — пока Worker считает, показываем спиннер/состояние «считаем».

## 3. Нецели

- Не выносим `countOuts`/`totalOuts`/`compareToNuts` — они лёгкие (<5мс), оставляем синхронно.
- Не оптимизируем сам алгоритм Монте-Карло (lookup-таблицы и т.д.) — только перенос в Worker.
- Не трогаем portable-режим — он для single-HTML сборок; Worker там не нужен (см. §6).

## 4. Архитектура

```
apps/app/src/
├── app.ts                MODIFY: async updateResults, обработка Worker-сообщений
├── equity-worker.ts      НОВЫЙ: Worker — принимает {holeCards, board, numOpp, iter}, возвращает eqRange
```

### 4.1. Worker-контракт

**Запрос (main → worker):**
```ts
interface EquityRequest {
  id: number;              // монотонный ID для отмены устаревших
  holeCards: Card[];
  board: Card[];
  numOpponents: number;
  iterations: number;
}
```

**Ответ (worker → main):**
```ts
interface EquityResponse {
  id: number;              // matching request
  percent: number;
  low: number;
  high: number;
}
```

### 4.2. equity-worker.ts

```ts
import { equityPercentRange } from '@poker/core';

self.onmessage = (e: MessageEvent<EquityRequest>) => {
  const { id, holeCards, board, numOpponents, iterations } = e.data;
  const result = equityPercentRange(holeCards, board, numOpponents, iterations);
  (self as any).postMessage({ id, ...result });
};
```

Worker импортирует `@poker/core` через Vite alias (уже настроен в vite.config.ts).

### 4.3. app.ts изменения

**Создание Worker (один раз, при старте):**
```ts
const equityWorker = new Worker(new URL('./equity-worker.ts', import.meta.url), { type: 'module' });
```

**Async updateResults:**
- `equityPercentRange` заменяется на `await requestEquity(worker, req)` — Promise, который резолвится по сообщению Worker.
- Пока ждём — UI свободен, можно показать loading.
- `getAdvice`/`countOuts`/`totalOuts` остаются синхронными (быстрые).

**Отмена устаревших расчётов:**
```ts
let equityRequestId = 0;
async function requestEquity(holeCards, board, numOpp, iter): Promise<EquityResponse> {
  const id = ++equityRequestId;
  equityWorker.postMessage({ id, holeCards, board, numOpponents: numOpp, iterations: iter });
  return new Promise(resolve => {
    const handler = (e: MessageEvent<EquityResponse>) => {
      if (e.data.id === id) {
        equityWorker.removeEventListener('message', handler);
        resolve(e.data);
      }
    };
    equityWorker.addEventListener('message', handler);
  });
}
```

При использовании: проверяем что `id` актуален перед применением результата — если пришёл новый запрос, старый игнорируем.

## 5. Loading-индикация

- При начале расчёта (postMessage) — добавляем класс `is-calculating` на результат-блок или показываем заглушку «Считаем…».
- При получении ответа — убираем класс, рендерим результат.
- Для автодебаунса (быстрый ввод) — loading не показываем (расчёт ~200мс, не успеет мигать). Только для кнопки «Рассчитать».

## 6. Portable-режим (single-HTML)

Portable-сборка (`build:portable-web`) использует IIFE + `inlineDynamicImports` — Workers в этом режиме не поддерживаются (нужен отдельный файл).

Решение: в portable-режиме Worker не создаётся, расчёт остаётся синхронным (как сейчас). Определяется через проверку `typeof Worker !== 'undefined'` или флаг сборки. Portable — это для офлайн-HTML, где задержка менее критична.

## 7. План миграции

1. Создать `equity-worker.ts`.
2. В `app.ts`: создать Worker, `requestEquity` Promise-обёртка, сделать `updateResults` async.
3. Отмена устаревших: `equityRequestId`, проверка актуальности.
4. Loading-индикация для кнопки.
5. Portable-режим: fallback на синхронный расчёт.
6. Проверка в браузере: UI не виснет при «Рассчитать», результат корректный.

## 8. Тесты

E2E (playwright) — проверить:
- Результат расчёта корректный (те же числа что и раньше).
- UI не блокируется во время расчёта (можно кликать другие элементы).

## 9. Риски

| Риск | Митигация |
|------|-----------|
| Worker не грузится (CORS, path) | Vite `new URL(..., import.meta.url)` — стандартный паттерн, работает в dev и build |
| Portable-режим ломается | Fallback на sync расчёт через `typeof Worker` проверку |
| Устаревшие результаты мелькают | `equityRequestId` — игнорируем ответы с неактуальным id |
| ASync ломает существующий flow (haptics, loading) | Тщательно сохранить порядок: расчёт → haptics → рендер |

## 10. Критерий готовности

- [ ] Кнопка «Рассчитать» не подвисает (UI жив во время расчёта)
- [ ] Результат корректный (те же числа что в sync-режиме)
- [ ] Автопересчёт работает (debounce + Worker)
- [ ] Устаревшие расчёты не мелькают
- [ ] Portable-сборка работает (sync fallback)
- [ ] E2E тесты проходят
