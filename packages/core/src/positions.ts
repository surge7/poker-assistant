/** Позиция за столом относительно дилера (0 = BTN, далее по часовой). */

export interface TablePosition {
  index: number;
  name: string;
  description: string;
}

const POSITION_DESCRIPTIONS: Record<string, string> = {
  'BTN': 'баттон/дилер, ходит последним (выгодная позиция)',
  'BTN/SB': 'баттон и малый блайнд в хедз-апе',
  'SB': 'малый блайнд',
  'BB': 'большой блайнд',
  'UTG': 'первый после блайндов (сложная позиция)',
  'UTG+1': 'второй ранний',
  'UTG+2': 'третий ранний',
  'MP': 'средняя позиция',
  'LJ': 'лоу-джек',
  'HJ': 'хай-джек',
  'CO': 'катофф — почти как баттон',
};

/** Средние позиции между UTG и CO для разного числа игроков (без BTN, SB, BB, CO). */
const MIDDLE_NAMES: Record<number, string[]> = {
  5: ['UTG'],
  6: ['UTG', 'MP'],
  7: ['UTG', 'MP', 'HJ'],
  8: ['UTG', 'UTG+1', 'MP', 'HJ'],
  9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ'],
  10: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ'],
};

export function clampNumPlayers(numPlayers: number): number {
  return Math.min(10, Math.max(2, Math.round(numPlayers)));
}

export function clampPositionIndex(positionIndex: number, numPlayers: number): number {
  const n = clampNumPlayers(numPlayers);
  return Math.max(0, Math.min(positionIndex, n - 1));
}

/** Короткое имя позиции для выбранного числа игроков. */
export function getPositionName(index: number, numPlayers: number): string {
  const n = clampNumPlayers(numPlayers);
  const i = clampPositionIndex(index, n);

  if (n === 2) return i === 0 ? 'BTN/SB' : 'BB';
  if (i === 0) return 'BTN';
  if (i === 1) return 'SB';
  if (i === 2) return 'BB';
  if (i === n - 1) return 'CO';

  const middle = MIDDLE_NAMES[n];
  return middle?.[i - 3] ?? `P${i}`;
}

/** Поздняя позиция (BTN, CO) — можно играть шире. */
export function isLatePosition(positionIndex: number, numPlayers: number): boolean {
  const n = clampNumPlayers(numPlayers);
  const i = clampPositionIndex(positionIndex, n);
  if (i === 0) return true;
  if (n >= 4 && i === n - 1) return true;
  return false;
}

/** Все позиции за столом для UI и подсказок. */
export function getTablePositions(numPlayers: number): TablePosition[] {
  const n = clampNumPlayers(numPlayers);
  return Array.from({ length: n }, (_, index) => {
    const name = getPositionName(index, n);
    return {
      index,
      name,
      description: POSITION_DESCRIPTIONS[name] ?? '',
    };
  });
}

/** HTML-подсказка по позициям для текущего числа игроков. */
export function getPositionHelpHtml(numPlayers: number): string {
  const parts = getTablePositions(numPlayers).map(
    (p) => `<strong>${p.name}</strong> — ${p.description}`
  );
  return `<p>${parts.join('. ')}.</p>`;
}
