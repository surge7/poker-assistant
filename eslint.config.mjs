// ESLint 9 flat config. Только качество кода; правила стиля сознательно
// не включены (форматирование не закреплено в этом проекте).
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      // dist-portable — сгенерированный бандл (одно-файловая сборка), не исходник.
      '**/dist-portable/**',
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
