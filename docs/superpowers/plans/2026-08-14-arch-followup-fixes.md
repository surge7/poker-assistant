# Follow-up fixes: отложенные Minor-находки Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Закрыть исправимые Minor-находки финального ревью (5 шт.); 2 находки сознательно не трогаем: watchdog-семантика «любой таймаут → disable» корректна по дизайну, а Android CI job проверяется только реальным прогоном.

**Tech Stack:** TypeScript, Vitest, GitHub Actions, npm.

## Global Constraints

- Ветка `ci/add-workflow-and-coverage`. Коммит после каждой задачи, только явные пути.
- Комментарии на русском, стиль соседних файлов.
- Запрещено менять поведение runtime-логики, кроме явно указанного null-guard.

---

### Task 9: null-guard в equity-client + склейка импортов в state.test

**Files:**
- Modify: `apps/app/src/equity-client.ts` (~строка 114, внутри `onMessage`)
- Modify: `apps/app/src/state.test.ts:1-2`

- [ ] **Step 1: null-guard**

В `request()`, в обработчике `onMessage`, заменить:
```ts
          this.worker!.removeEventListener('message', onMessage);
```
на:
```ts
          // После disable() (watchdog/error) воркер занулён — позднее
          // сообщение не должно падать с TypeError на removeEventListener.
          if (this.worker) this.worker.removeEventListener('message', onMessage);
```
Другие строки метода не менять.

- [ ] **Step 2: склеить импорты в `state.test.ts`**

Две строки:
```ts
import { getDefaultState, saveState, loadState, clearState } from './state';
import type { AppState } from './state';
```
заменить одной:
```ts
import { getDefaultState, saveState, loadState, clearState, type AppState } from './state';
```

- [ ] **Step 3: Проверки**

Run: `npm test -w app && npm run typecheck && npm run lint`
Expected: 27/27, exit 0, exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/equity-client.ts apps/app/src/state.test.ts
git commit -m "fix(app): null-guard late worker message, merge test imports"
```

---

### Task 10: building.md формулировка, CI upload на success, exports порядок

**Files:**
- Modify: `docs/building.md:3`
- Modify: `.github/workflows/ci.yml` (только upload-шаг job'а `android-debug-apk`)
- Modify: `packages/core/package.json` (exports map)

- [ ] **Step 1: building.md**

Строку-примечание о происхождении (упоминает уже удалённые пути `apps/app/BUILD_*.md`) переформулировать так, чтобы читатель не искал несуществующие файлы, например:
```
Объединяет пять прежних руководств BUILD_*.md (удалены из apps/app; содержание перенесено сюда без потерь).
```
Смысл и остальной текст не менять.

- [ ] **Step 2: ci.yml upload-шаг**

В job'е `android-debug-apk` у шага `Upload APK` заменить:
```yaml
        if: ${{ !cancelled() }}
```
на:
```yaml
        if: success()
```
Обоснование: при падении assembleDebug артефакта APK нет — upload только создаёт шум «No files were found». Upload-шаг job'а `e2e` НЕ трогать (там отчёт существует и при падениях).

- [ ] **Step 3: packages/core/package.json exports**

Условие `"types"` поставить первым в map (advisory tsup/Node resolution):
```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
```
Поля main/module/types не менять.

- [ ] **Step 4: Проверки**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')" && npm run build:core && npm test -w @poker/core && npm run lint`
Expected: `YAML OK`, сборка успешна, 118/118, lint exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/building.md .github/workflows/ci.yml packages/core/package.json
git commit -m "chore: fix deferred review minors (docs wording, ci upload gate, exports order)"
```
