import { RANKS, SUITS, type Card } from './types';

const SUIT_NAMES: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

/** Полная колода из 52 карт в фиксированном порядке */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push(`${r}${s}`);
    }
  }
  return deck;
}

/** Перемешать колоду (Fisher–Yates). Если передан random, используется он — для детерминированной симуляции. */
export function shuffleDeck(deck: Card[], random: () => number = Math.random): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Удалить из колоды карты, уже известные (борд + свои + опционально чужие) */
export function removeKnown(deck: Card[], known: Card[]): Card[] {
  const set = new Set(known);
  return deck.filter((c) => !set.has(c));
}

/** Проверить, что строка — валидная карта */
export function isValidCard(card: string): card is Card {
  if (card.length !== 2) return false;
  const r = card[0];
  const s = card[1];
  return RANKS.includes(r as any) && SUITS.includes(s as any);
}

/** Форматирование карты для отображения (опционально) */
export function formatCard(card: Card): string {
  const s = SUIT_NAMES[card[1]] ?? card[1];
  return `${card[0]}${s}`;
}
