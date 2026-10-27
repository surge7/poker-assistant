# Contributing

Thanks for your interest in improving the Poker Trainer!

## Setup

```bash
git clone https://github.com/surge7/poker-assistant.git
cd poker-assistant
npm install          # Node.js 22+ (see .nvmrc)
```

## Development workflow

1. Create a branch from `main`.
2. Make your change. Keep it focused — one logical change per PR.
3. Run the full local check before pushing:

```bash
npm run typecheck                    # TypeScript, all workspaces
npm run lint                         # ESLint
npm test -w @poker/core -- --coverage
npm test -w app
npm run build && npm run test:e2e -w app   # e2e needs a fresh build
```

CI runs the same jobs (plus an Android debug APK build) on every PR, and it
must pass before merge.

## Guidelines

- **Language of code/comments**: code, identifiers and new test names are in
  English; user-facing strings must be added for both locales
  (`packages/core/src/i18n/en.ts` and `ru.ts`) — see `i18n.test.ts` which
  enforces parity.
- **Core package purity**: `@poker/core` must stay UI- and network-free.
  Browser/Android APIs belong in `apps/app`.
- **Tests**: bug fixes should come with a regression test. Core coverage
  thresholds (lines ≥ 88%, branches ≥ 85%) are enforced in CI.
- **Commits**: conventional-commit style (`feat:`, `fix:`, `test:`, `docs:`,
  `chore:`) — see `git log` for examples.
- **No secrets**: never commit tokens or keystore files. See
  `.env.yandex.example` for the expected shape of local config.

## Reporting bugs

Open an issue with: what you did, what you expected, what happened, and the
app version (see `apps/app/package.json` or the store listing).
