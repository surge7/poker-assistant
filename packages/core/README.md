# @poker/core

Ядро покерного помощника: оценка рук, ауты, эквити, натс, советы. Без UI и без сети.

## Структура модулей

| Файл | Назначение |
|------|------------|
| `types.ts` | Карта, фаза, HandRank, HandStrength, TableContext, AdviceResult |
| `deck.ts` | Колода, перемешивание, удаление известных карт, валидация |
| `hand-eval.ts` | Оценка комбинации (5–7 карт), сравнение рук, определение победителя |
| `outs.ts` | Подсчёт аутов (флеш/стрит/оверкарты), шанс улучшения |
| `equity.ts` | Эквити (Монте-Карло) против N оппонентов |
| `nuts.ts` | Натс на борде, сравнение своей руки с натсом |
| `advice.ts` | Простые советы (fold/check/call/raise) по контексту стола |
| `index.ts` | Публичный API пакета |

## Использование

```ts
import {
  evaluatePlayerHand,
  countOuts,
  equityPercent,
  compareToNuts,
  getAdvice,
} from '@poker/core';

const holeCards = ['As', 'Kh'];
const board = ['Qs', 'Js', 'Ts', '2c', '7d'];

const strength = evaluatePlayerHand(holeCards, board);
const outs = countOuts(holeCards, board);
const eq = equityPercent(holeCards, board, 1);
const { isNuts } = compareToNuts(holeCards, board);
const advice = getAdvice({
  phase: 'river',
  board,
  holeCards,
  potSize: 100,
  toCall: 20,
  numPlayers: 2,
  positionIndex: 0,
});
```

## Сборка

```bash
npm run build
```

Выход: `dist/index.js` (CJS), `dist/index.mjs` (ESM), `dist/index.d.ts`.
