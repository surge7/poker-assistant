# Архитектурные рекомендации: реализация Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Внедрить 8 рекомендаций из архитектурного анализа: typecheck и lint в CI, Android-сборка в CI, юнит-тесты app, watchdog в EquityClient, чистка зависимостей и гигиена репозитория.

**Architecture:** Monorepo npm workspaces: `packages/core` (чистая покерная логика) + `apps/app` (Vite + Capacitor). Все изменения — additive; существующее поведение не меняется, кроме добавления таймаута в EquityClient (расширение, совместимое с текущим API).

**Tech Stack:** TypeScript 5.3, Vitest 2, happy-dom, ESLint 9 + typescript-eslint 8, GitHub Actions, Gradle 9.1 / Capacitor 6.

## Global Constraints

- Ветка: `ci/add-workflow-and-coverage` (текущая). Коммит после каждой задачи.
- В рабочей копии есть НЕ наши грязные файлы: `apps/app/android/app/build.gradle`, `apps/app/store-screenshots*/*`, `apps/app/RELEASE_NOTES_1.5*.txt`. **Запрещено `git add -A` / `git add .`** — только явные пути из шага Commit.
- Node: CI пиннит 22; локально может быть 26 — ок.
- Комментарии в коде — на русском, в стиле соседних файлов.
- Новые зависимости в `apps/app` — только devDependencies (runtime-бандл не растёт).
- Комментарии/строки кода не «переводить», стиль существующих файлов сохранять.
- Каждый шаг с командой должен быть выполнен; ожидаемый вывод указан рядом.

---

### Task 1: Vitest-инфраструктура в apps/app + тесты state.ts

**Files:**
- Create: `apps/app/vitest.config.ts`
- Create: `apps/app/src/state.test.ts`
- Modify: `apps/app/package.json` (devDependencies + scripts)

**Interfaces:**
- Consumes: `saveState/loadState/clearState/getDefaultState` из `apps/app/src/state.ts` (уже существуют).
- Produces: команда `npm test -w app` проходит; env `happy-dom`; alias `@poker/core → ../../packages/core/src/index.ts` (используют задачи 2–3).

- [ ] **Step 1: Добавить devDeps и скрипты в `apps/app/package.json`**

В `"devDependencies"` добавить (сортировку сохранить):
```json
    "happy-dom": "^15.11.7",
    "vitest": "^2.1.9",
```
В `"scripts"` добавить после `"test:e2e:ui"`:
```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 2: Установить зависимости**

Run: `npm install`
Expected: lockfile обновлён, `node_modules/vitest` существует, exit 0.

- [ ] **Step 3: Создать `apps/app/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Alias @poker/core на исходники ядра: юнит-тесты app не требуют
// предварительной сборки packages/core (dist/).
export default defineConfig({
  resolve: {
    alias: {
      '@poker/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Написать `apps/app/src/state.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultState, saveState, loadState, clearState } from './state';

describe('state persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    clearState();
  });

  it('roundtrips a valid state through localStorage', () => {
    const s = { ...getDefaultState(), holeCards: ['As', 'Kd'], potSize: 100 };
    saveState(s);
    expect(loadState()).toEqual(s);
  });

  it('returns null when nothing is stored', () => {
    expect(loadState()).toBeNull();
  });

  it('rejects corrupted JSON', () => {
    localStorage.setItem('poker-assistant:state:v1', '{not json');
    expect(loadState()).toBeNull();
  });

  it('rejects wrong version', () => {
    const s = { ...getDefaultState(), version: 2 };
    localStorage.setItem('poker-assistant:state:v1', JSON.stringify(s));
    expect(loadState()).toBeNull();
  });

  it('rejects invalid cards', () => {
    const s = { ...getDefaultState(), holeCards: ['ZZ', null] };
    localStorage.setItem('poker-assistant:state:v1', JSON.stringify(s));
    expect(loadState()).toBeNull();
  });

  it('rejects wrong field types', () => {
    const s = { ...getDefaultState(), numPlayers: 'six' };
    localStorage.setItem('poker-assistant:state:v1', JSON.stringify(s));
    expect(loadState()).toBeNull();
  });

  it('clearState removes stored state', () => {
    saveState(getDefaultState());
    clearState();
    expect(loadState()).toBeNull();
  });
});
```
Примечание: TS может ругаться на `version: 2` / `'six'` — если да, использовать `as unknown as`-приведение к типу аргумента.

- [ ] **Step 5: Прогнать тесты**

Run: `npm test -w app`
Expected: 7 passed. Если happy-dom не предоставляет localStorage — заменить environment на `jsdom` (добавить devDep `jsdom`) и повторить.

- [ ] **Step 6: Commit**

```bash
git add apps/app/package.json apps/app/vitest.config.ts apps/app/src/state.test.ts package-lock.json
git commit -m "test(app): add vitest infra + state persistence unit tests"
```

---

### Task 2: Тесты format.ts и picker.ts

**Files:**
- Create: `apps/app/src/format.test.ts`
- Create: `apps/app/src/picker.test.ts`

**Interfaces:**
- Consumes: vitest-инфраструктура из Task 1; функции из `format.ts`/`picker.ts` (уже существуют).

- [ ] **Step 1: Написать `apps/app/src/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { explanationRow, formatExplanationPct, formatGapPp, actionClass, equityClass } from './format';

describe('formatExplanationPct', () => {
  it('integer without fraction', () => expect(formatExplanationPct(50)).toBe('50'));
  it('one decimal', () => expect(formatExplanationPct(52.25)).toBe('52.3'));
  it('rounds to one decimal', () => expect(formatExplanationPct(33.34)).toBe('33.3'));
});

describe('formatGapPp', () => {
  it('positive with plus', () => expect(formatGapPp(12.5)).toBe('+12.5'));
  it('negative with unicode minus', () => expect(formatGapPp(-5)).toBe('−5'));
});

describe('actionClass', () => {
  it('fold → --fold', () => expect(actionClass('fold')).toContain('--fold'));
  it('check → --neutral', () => expect(actionClass('check')).toContain('--neutral'));
  it('other → --positive', () => expect(actionClass('raise')).toContain('--positive'));
});

describe('equityClass', () => {
  it('low equity → --low', () => expect(equityClass(20)).toContain('--low'));
  it('normal equity → no --low', () => expect(equityClass(50)).not.toContain('--low'));
});

describe('explanationRow', () => {
  it('renders note when provided', () => {
    expect(explanationRow('L', 'V', 'N')).toContain('explanation-note');
  });
  it('omits note when absent', () => {
    expect(explanationRow('L', 'V')).not.toContain('explanation-note');
  });
});
```
Примечание: `−5` — это U+2212 (как в `format.ts`), не обычный дефис.

- [ ] **Step 2: Написать `apps/app/src/picker.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildCardSelects,
  buildBoardCardSelects,
  setSlotCard,
  getSlotCard,
  removeDuplicateCards,
  readCardSelects,
} from './picker';

describe('picker', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="hole"></div><div id="board"></div>';
  });

  it('builds 2 hole slots and 5 board slots', () => {
    buildCardSelects(document.getElementById('hole')!, 2, 'hole');
    buildBoardCardSelects(document.getElementById('board')!);
    expect(document.getElementById('hole-rank-0')).toBeTruthy();
    expect(document.getElementById('hole-rank-1')).toBeTruthy();
    expect(document.getElementById('board-rank-4')).toBeTruthy();
  });

  it('setSlotCard/getSlotCard roundtrip', () => {
    buildCardSelects(document.getElementById('hole')!, 2, 'hole');
    setSlotCard(0, 'As');
    expect(getSlotCard(0)).toBe('As');
    setSlotCard(0, null);
    expect(getSlotCard(0)).toBeNull();
  });

  it('removeDuplicateCards keeps first occurrence, clears later duplicates', () => {
    buildCardSelects(document.getElementById('hole')!, 2, 'hole');
    buildBoardCardSelects(document.getElementById('board')!);
    setSlotCard(0, 'As');
    setSlotCard(1, 'As');
    setSlotCard(2, 'Kd');
    removeDuplicateCards();
    expect(getSlotCard(0)).toBe('As');
    expect(getSlotCard(1)).toBeNull();
    expect(getSlotCard(2)).toBe('Kd');
  });

  it('readCardSelects returns only fully selected cards', () => {
    buildBoardCardSelects(document.getElementById('board')!);
    setSlotCard(2, '7c'); // слот 2 глобальный = board-0
    expect(readCardSelects(document.getElementById('board')!, 'board')).toEqual(['7c']);
  });
});
```

- [ ] **Step 3: Прогнать тесты**

Run: `npm test -w app`
Expected: все тесты Task 1 + Task 2 прошли (7 + 12). Если picker-тесты падают на особенностях happy-dom — переключить environment на `jsdom` (devDep `jsdom`) и проверить снова.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/format.test.ts apps/app/src/picker.test.ts
git commit -m "test(app): unit tests for format and picker modules"
```

---

### Task 3: Watchdog-таймаут в EquityClient

**Files:**
- Modify: `apps/app/src/equity-client.ts` (полная замена, код ниже)
- Create: `apps/app/src/equity-client.test.ts`

**Interfaces:**
- Consumes: `EquityClient` (существующий API: `new EquityClient(url)`, `.request(params)`).
- Produces: `new EquityClient(url, { workerFactory?, timeoutMs? })` — второй аргумент опционален, `app.ts` не меняется. Тестируемость через `workerFactory`.

**Контракт сохраняется:** ответы на запросы приходят с корректным `isStale`; при таймауте — disable() + sync-fallback; `isStale` вычисляется как `id !== requestId` (последний запрос не stale, даже если он дренируется через sync).

- [ ] **Step 1: Написать `apps/app/src/equity-client.test.ts` (тест падает — watchdog ещё не реализован)**

```ts
import { describe, it, expect } from 'vitest';
import { EquityClient } from './equity-client';

const URL_STR = new URL('file:///equity-worker');
const AA = { holeCards: ['As' as const, 'Ah' as const], board: [] as never[], numOpponents: 1, iterations: 1000 };

/** Воркер-заглушка: postMessage молчит, никогда не отвечает. */
class SilentWorker {
  addEventListener() {}
  removeEventListener() {}
  postMessage() {}
  terminate() {}
}

/** Воркер с ручным ответом: слушатели складываются в список. */
class ManualWorker {
  handlers: ((e: { data: unknown }) => void)[] = [];
  sent: { id: number }[] = [];
  addEventListener(_t: string, cb: (e: { data: unknown }) => void) { this.handlers.push(cb); }
  removeEventListener(_t: string, cb: (e: { data: unknown }) => void) {
    this.handlers = this.handlers.filter((h) => h !== cb);
  }
  postMessage(msg: { id: number }) { this.sent.push(msg); }
  reply(id: number, percent = 50) {
    for (const h of [...this.handlers]) h({ data: { id, percent, low: 40, high: 60 } });
  }
  terminate() {}
}

describe('EquityClient', () => {
  it('falls back to sync when worker never responds (watchdog)', async () => {
    const client = new EquityClient(URL_STR, {
      workerFactory: () => new SilentWorker() as unknown as Worker,
      timeoutMs: 20,
    });
    const r = await client.request({ ...AA });
    // AA против 1 оппонента ≈ 85% эквити; sync-fallback считает честно.
    expect(r.percent).toBeGreaterThan(50);
    expect(r.isStale).toBe(false);
  }, 10_000);

  it('falls back to sync when worker factory throws', async () => {
    const client = new EquityClient(URL_STR, {
      workerFactory: () => { throw new Error('no workers here'); },
    });
    const r = await client.request({ ...AA });
    expect(r.percent).toBeGreaterThan(50);
  }, 10_000);

  it('marks late answer stale when a newer request exists', async () => {
    const w = new ManualWorker();
    const client = new EquityClient(URL_STR, {
      workerFactory: () => w as unknown as Worker,
      timeoutMs: 60_000,
    });
    const p1 = client.request({ ...AA, iterations: 10 });
    const p2 = client.request({ ...AA, iterations: 10 });
    w.reply(2);
    w.reply(1);
    const [r2, r1] = await Promise.all([p2, p1]);
    expect(r2.isStale).toBe(false);
    expect(r1.isStale).toBe(true);
    expect(r1.percent).toBe(50);
  });

  it('watchdog terminates the worker after timeout', async () => {
    const w = new ManualWorker();
    let terminated = false;
    w.terminate = () => { terminated = true; };
    const client = new EquityClient(URL_STR, {
      workerFactory: () => w as unknown as Worker,
      timeoutMs: 20,
    });
    await client.request({ ...AA, iterations: 100 });
    expect(terminated).toBe(true);
  }, 10_000);
});
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run src/equity-client.test.ts` (в `apps/app`)
Expected: FAIL — `workerFactory` не существует / тест watchdog зависает по таймауту vitest.

- [ ] **Step 3: Заменить реализацию `apps/app/src/equity-client.ts`**

```ts
/**
 * Клиент для расчёта эквити через Web Worker (async) с fallback на sync.
 *
 * Worker грузится асинхронно через new Worker(URL). Если не загрузился
 * (single-HTML, Android WebView, отсутствие поддержки) — падаем на sync.
 *
 * Очередь запросов монотонна: stale результаты отбрасываются по id.
 * Watchdog: если воркер молчит дольше timeoutMs — переходим на sync,
 * чтобы UI не зависал на никогда не разрешающемся промисе.
 */

import type { Card } from '@poker/core';
import { calcEquitySync } from './equity-fallback';

export interface EquityParams {
  holeCards: Card[];
  board: Card[];
  numOpponents: number;
  iterations: number;
}

export interface EquityResult {
  percent: number;
  low: number;
  high: number;
  isStale: boolean;
}

/** Фабрика воркера — инъекция для тестов (по умолчанию new Worker). */
export type WorkerFactory = (workerUrl: URL) => Worker;

export interface EquityClientOptions {
  workerFactory?: WorkerFactory;
  /** Сколько мс ждать ответа воркера до перехода на sync. */
  timeoutMs?: number;
}

interface PendingEntry {
  resolve: (r: EquityResult) => void;
  params: EquityParams;
  timer?: ReturnType<typeof setTimeout>;
}

/** Таймаут ответа воркера по умолчанию. */
const DEFAULT_TIMEOUT_MS = 4000;

function defaultWorkerFactory(workerUrl: URL): Worker {
  return new Worker(workerUrl, { type: 'module' });
}

/** Клиент эквити: создаёт воркер, обрабатывает ошибки, отбрасывает stale. */
export class EquityClient {
  private worker: Worker | null = null;
  private disabled = false;
  private requestId = 0;
  private pending = new Map<number, PendingEntry>();

  constructor(workerUrl: URL, private options: EquityClientOptions = {}) {
    try {
      this.worker = (options.workerFactory ?? defaultWorkerFactory)(workerUrl);
      this.worker.addEventListener('error', () => this.disable());
      this.worker.addEventListener('messageerror', () => this.disable());
    } catch {
      this.disable();
    }
  }

  private disable(): void {
    if (this.disabled) return;
    this.disabled = true;
    if (this.worker) {
      try { this.worker.terminate(); } catch { /* noop */ }
      this.worker = null;
    }
    // Слить ожидающие запросы через sync, чтобы UI не завис.
    for (const [id, entry] of this.pending) {
      if (entry.timer) clearTimeout(entry.timer);
      try {
        const r = calcEquitySync(entry.params.holeCards, entry.params.board, entry.params.numOpponents, entry.params.iterations);
        entry.resolve({ ...r, isStale: id !== this.requestId });
      } catch {
        entry.resolve({ percent: 0, low: 0, high: 0, isStale: id !== this.requestId });
      }
    }
    this.pending.clear();
  }

  /** Запросить эквити. Возвращает Promise с результатом и флагом isStale. */
  request(params: EquityParams): Promise<EquityResult> {
    const id = ++this.requestId;
    const checkStale = () => id !== this.requestId;

    if (!this.worker || this.disabled) {
      const r = calcEquitySync(params.holeCards, params.board, params.numOpponents, params.iterations);
      return Promise.resolve({ ...r, isStale: checkStale() });
    }

    try {
      this.worker.postMessage({ id, ...params });
    } catch {
      const r = calcEquitySync(params.holeCards, params.board, params.numOpponents, params.iterations);
      return Promise.resolve({ ...r, isStale: checkStale() });
    }

    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise<EquityResult>((resolve) => {
      const entry: PendingEntry = { resolve, params };
      this.pending.set(id, entry);
      entry.timer = setTimeout(() => this.disable(), timeoutMs);
      const onMessage = (e: MessageEvent) => {
        const data = e.data as { id: number; percent: number; low: number; high: number };
        if (data.id === id) {
          this.worker!.removeEventListener('message', onMessage);
          if (entry.timer) clearTimeout(entry.timer);
          this.pending.delete(id);
          resolve({ percent: data.percent, low: data.low, high: data.high, isStale: checkStale() });
        }
      };
      this.worker!.addEventListener('message', onMessage);
    });
  }
}
```

- [ ] **Step 4: Прогнать все тесты app**

Run: `npm test -w app`
Expected: все тесты (Task 1–3) прошли. Watchdog-тесты со sync-расчётом могут занять пару секунд (iterations 1000) — это ок.

- [ ] **Step 5: Typecheck и smoke e2e**

Run: `npx tsc --noEmit -p apps/app/tsconfig.json`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/equity-client.ts apps/app/src/equity-client.test.ts
git commit -m "feat(app): equity client watchdog timeout with sync fallback"
```

---

### Task 4: Чистка зависимостей workspace + .nvmrc

**Files:**
- Modify: `apps/app/package.json:33` (`"@poker/core": "file:../../packages/core"` → `"*"`)
- Create: `.nvmrc`

- [ ] **Step 1: Заменить зависимость**

В `apps/app/package.json` строку `"@poker/core": "file:../../packages/core"` заменить на `"@poker/core": "*"`.

- [ ] **Step 2: Создать `.nvmrc`**

```
22
```

- [ ] **Step 3: Переустановить и проверить симлинк**

Run: `npm install && ls -la node_modules/@poker`
Expected: `core -> ../../packages/core` (симлинк сохранён), exit 0.

Run: `npm run build:core && npm run build -w app`
Expected: обе сборки прошли (vite build завершён без ошибок).

- [ ] **Step 4: Commit**

```bash
git add apps/app/package.json .nvmrc package-lock.json
git commit -m "chore: workspace dep by name (not file:), add .nvmrc"
```

---

### Task 5: ESLint 9 (flat config) в корне

**Files:**
- Create: `eslint.config.mjs`
- Modify: root `package.json` (devDeps + script)

**Interfaces:**
- Produces: команда `npm run lint` (используется в CI, Task 7).

- [ ] **Step 1: devDeps и скрипт в корневом `package.json`**

```json
  "devDependencies": {
    "eslint": "^9.17.0",
    "typescript": "^5.3.0",
    "typescript-eslint": "^8.18.0"
  }
```
Скрипт (после `"build:app"`):
```json
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p packages/core/tsconfig.json && tsc --noEmit -p apps/app/tsconfig.json",
```

- [ ] **Step 2: `npm install`**

Run: `npm install`
Expected: exit 0.

- [ ] **Step 3: Создать `eslint.config.mjs`**

```js
// ESLint 9 flat config. Только качество кода; правила стиля сознательно
// не включены (форматирование не закреплено в этом проекте).
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/android/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '.playwright-mcp/**',
      '.worktrees/**',
      'test-sessions/**',
      'apps/app/poker-assistant.html',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
```

- [ ] **Step 4: Прогнать линтер, починить нарушения**

Run: `npm run lint`
Expected: 0 errors. Warnings (`no-explicit-any`) допустимы.
Если generator-скрипты (`apps/app/scripts/*.js`) дают шумные ошибки — чинить точечно; полностью шумный файл добавлять в `ignores` с комментарием.

- [ ] **Step 5: Проверить, что тесты и typecheck целы**

Run: `npm run typecheck && npm test -w @poker/core && npm test -w app`
Expected: всё зелёное.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json
# + файлы, правленные в Step 4, если были
git commit -m "chore: add eslint 9 flat config with typescript-eslint"
```

---

### Task 6: Гигиена репозитория (CHANGELOG, docs/building.md, icon_backup)

**Files:**
- Create: `CHANGELOG.md`
- Create: `docs/building.md`
- Delete (git rm): `apps/app/RELEASE_NOTES_1.1_ru.txt`, `apps/app/BUILD_ANDROID.md`, `apps/app/BUILD_WEB.md`, `apps/app/BUILD_YANDEX_WEB.md`, `apps/app/BUILD_RU_CLOUD.md`, `apps/app/BUILD_CLOUDFLARE_PAGES.md`
- Untrack: `apps/app/icon_backup/` (файлы остаются на диске)
- Modify: `.gitignore`

**ВАЖНО:** `apps/app/RELEASE_NOTES_1.5_ru.txt` и `RELEASE_NOTES_1.5_rustore.txt` — untracked, нужны пользователю для текущего релиза. НЕ удалять, НЕ коммитить.

- [ ] **Step 1: Создать `CHANGELOG.md`**

Прочитать `apps/app/RELEASE_NOTES_1.1_ru.txt`, `apps/app/RELEASE_NOTES_1.5_ru.txt`, `apps/app/RELEASE_NOTES_1.5_rustore.txt` и собрать в формат:

```markdown
# Changelog

История релизов приложения. Источник истины для заметок в сторах.

## 1.5.0
(содержимое RELEASE_NOTES_1.5_ru.txt; отличия rustore-версии — подразделом «### RuStore»)

## 1.1.0
(содержимое RELEASE_NOTES_1.1_ru.txt)
```

- [ ] **Step 2: Создать `docs/building.md`**

Прочитать 5 файлов `apps/app/BUILD_*.md`, объединить без потерь в один документ со структурой:
`# Сборка и развёртывание` → разделы `## Web (локально)`, `## Android APK`, `## Web-хостинги` (подразделы Yandex / Ru-Cloud / Cloudflare Pages). Скрипты, переменные окружения и команды переносить дословно.

- [ ] **Step 3: Убрать старые файлы из git, разъuntrack'нуть icon_backup**

```bash
git rm apps/app/RELEASE_NOTES_1.1_ru.txt apps/app/BUILD_ANDROID.md apps/app/BUILD_WEB.md apps/app/BUILD_YANDEX_WEB.md apps/app/BUILD_RU_CLOUD.md apps/app/BUILD_CLOUDFLARE_PAGES.md
git rm -r --cached apps/app/icon_backup
```
В `.gitignore` добавить (в секцию про Android/артефакты):
```
# Дизайн-исходники иконок (не для git)
apps/app/icon_backup/
```

- [ ] **Step 4: Проверить**

Run: `git status --porcelain | head -20`
Expected: наши deletions/добавления; `apps/app/icon_backup/*` НЕ в untracked (игнорируется); RELEASE_NOTES_1.5* остались untracked.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md docs/building.md .gitignore
git commit -m "docs: consolidate build guides and changelog, untrack icon sources"
```
(deletions уже в index от `git rm`.)

---

### Task 7: Обновление CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run typecheck`, `npm run lint`, `npm test -w app` (из задач 1–5), `npm run build`, `npx cap sync android`, `./gradlew assembleDebug`.

- [ ] **Step 1: Добавить 4 новых job после `test-core`**

(job `typecheck`)
```yaml
  typecheck:
    name: Typecheck (tsc --noEmit)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      # tsup/vite/esbuild НЕ проверяют типы — этот job единственная защита.
      - run: npm run typecheck
```

(job `lint`)
```yaml
  lint:
    name: Lint (ESLint)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
```

(job `test-app` — юнит-тесты app, happy-dom, браузер не нужен)
```yaml
  test-app:
    name: App unit tests (Vitest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm test -w app
```

(job `android-debug-apk` — debug-сборка как smoke Android-канала)
```yaml
  android-debug-apk:
    name: Android debug APK
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      # web-сборка в android/assets через cap sync
      - run: npm run build
      - run: npx cap sync android
        working-directory: apps/app
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - uses: gradle/actions/setup-gradle@v4
      - name: Assemble debug APK
        working-directory: apps/app/android
        run: ./gradlew assembleDebug --stacktrace
      - name: Upload APK
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: app-debug-apk
          path: apps/app/android/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 2: Обновить шапку-комментарий workflow**

В блоке комментариев сверху перечислить актуальные job'ы (test-core, test-app, typecheck, lint, e2e, android-debug-apk) одной строкой на каждый.

- [ ] **Step 3: Проверить YAML локально**

Run: `npx yaml-lint .github/workflows/ci.yml 2>/dev/null || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"`
Expected: `YAML OK`.

- [ ] **Step 4: Локальная проверка всех команд из job'ов**

Run: `npm run typecheck && npm run lint && npm test -w @poker/core && npm test -w app`
Expected: всё зелёное (gradlew-часть проверится в CI; локально НЕ запускать — долго).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add typecheck, lint, app unit tests and android apk jobs"
```

---

### Task 8: Финальная верификация

**Files:** — (только проверки; при падениях — точечные фиксы с коммитом `fix: ...`)

- [ ] **Step 1: Полный локальный прогон**

```bash
npm run typecheck
npm run lint
npm test -w @poker/core
npm test -w app
npm run build
```
Expected: всё зелёное.

- [ ] **Step 2: E2E (если браузеры Playwright установлены)**

Run: `cd apps/app && npx playwright test`
Expected: 17 passed. Если браузеры не установлены: `npx playwright install chromium` и повторить. Если e2e недоступен локально — отметить в отчёте, CI проверит.

- [ ] **Step 3: Санити git**

Run: `git status --porcelain`
Expected: только исходные грязные файлы пользователя (`apps/app/android/app/build.gradle`, `store-screenshots*`, `RELEASE_NOTES_1.5*`) — никаких наших незакоммиченных изменений.

Run: `git log --oneline -8`
Expected: 7 наших коммитов поверх `bd7779b`.

- [ ] **Step 4: Отчёт**

Собрать: что сделано, результаты прогонов (точные числа тестов), что осталось на CI (android job, e2e).
