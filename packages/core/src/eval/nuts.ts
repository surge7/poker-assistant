import { createDeck, removeKnown } from './deck';
import { evaluatePlayerHand, compareHands } from './hand-eval';
import type { Card } from '../types';
import type { HandStrength } from '../types';

/**
 * Натс на данном борде — лучшая возможная рука из карт борда + любых двух из колоды.
 * Работает для любого размера борда от 3 до 5 карт (флоп/терн/ривер).
 * На флопе/терне это «текущий натс» — лучшая рука на данный момент.
 * Считается перебором всех комбинаций из 2 карт из оставшейся колоды.
 */
export function getNuts(board: Card[]): HandStrength | null {
  if (board.length < 3 || board.length > 5) return null;

  const deck = createDeck();
  const remaining = removeKnown(deck, board);
  let best: HandStrength | null = null;

  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const hand = evaluatePlayerHand([remaining[i], remaining[j]], board);
      if (!best || compareHands(hand, best) > 0) {
        best = hand;
      }
    }
  }
  return best;
}

/**
 * Сравнение текущей руки с натсом.
 * Возвращает: описание натса, наша рука, и «мы на натсе» / «мы в X% от натса» (упрощённо).
 */
export function compareToNuts(holeCards: Card[], board: Card[]): {
  nuts: HandStrength | null;
  ourHand: HandStrength;
  isNuts: boolean;
  description: string;
} {
  const nuts = getNuts(board);
  const ourHand = evaluatePlayerHand(holeCards, board);

  if (!nuts) {
    return {
      nuts: null,
      ourHand,
      isNuts: false,
      description: 'Для натса нужно минимум 3 карты на борде (флоп).',
    };
  }

  const cmp = compareHands(ourHand, nuts);
  const isNuts = cmp >= 0;

  let description: string;
  if (isNuts) {
    description = 'У вас натс (лучшая возможная рука на этом борде).';
  } else {
    description = `Натс на борде: ${nuts.name}. У вас: ${ourHand.name}.`;
  }

  return {
    nuts,
    ourHand,
    isNuts,
    description,
  };
}
