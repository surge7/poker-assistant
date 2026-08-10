import { defineConfig } from 'vitest/config';

// Покрытие измеряется только при запуске с флагом --coverage
// (см. .github/workflows/ci.yml, job test-core). Локально `npm test`
// остаётся быстрым — без покрытия.
//
// Пороги установлены с запасом ~5% ниже измеренного базового уровня
// (Lines 93.73 / Stmts 93.73 / Funcs 91.3 / Branches 90), чтобы:
//   - не ломать CI на минорных колебаниях покрытия;
//   - падать, если новый код попадает в репозиторий без тестов
//     (просадка > ~5% на кодобазе такого размера = явный регресс).
// Пороги глобальные (не per-file): иначе бочки/index.ts с 0% роняют билд.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 88,
        statements: 88,
        functions: 85,
        branches: 85,
      },
    },
  },
});
