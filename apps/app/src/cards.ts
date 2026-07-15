import type { Card } from '@poker/core';

declare global {
  interface Window {
    /** Встроенные data URI — однофайловая сборка (build:single-html) */
    __PA_CARDS__?: Record<string, string>;
  }
}

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

const RANK_LABELS: Record<string, string> = {
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

function rankLabel(rank: string): string {
  return RANK_LABELS[rank] ?? rank;
}

function suitSymbol(suit: string): string {
  return SUIT_SYMBOLS[suit] ?? suit;
}

export function cardImageUrl(card: Card): string {
  const embedded = typeof window !== 'undefined' ? window.__PA_CARDS__?.[card] : undefined;
  if (embedded) return embedded;
  // Vite подменяет import.meta.env на этапе build; для tsc --noEmit тип
  // недоступен без vite/client types. Используем typecast.
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '';
  return `${base}cards/${card}.webp`;
}

export function cardAltText(card: Card): string {
  return `${rankLabel(card[0])}${suitSymbol(card[1])}`;
}

export function cardToHtml(card: Card, className = 'card-img'): string {
  const alt = cardAltText(card);
  return `<span class="card-face card-face--static"><img class="${className}" src="${cardImageUrl(card)}" alt="${alt}" title="${alt}" loading="lazy" decoding="async" /></span>`;
}

function mountCardFace(parent: HTMLElement, card: Card, imgClass: string): void {
  parent.replaceChildren();
  const face = document.createElement('span');
  face.className = 'card-face';

  const img = document.createElement('img');
  img.className = imgClass;
  img.src = cardImageUrl(card);
  img.alt = cardAltText(card);
  img.decoding = 'async';

  face.append(img);
  parent.append(face);
}

export function setTriggerCardImage(trigger: HTMLElement, card: Card | null): void {
  if (!card) {
    trigger.replaceChildren();
    trigger.textContent = '—';
    trigger.classList.add('card-picker-trigger--empty');
    return;
  }

  trigger.classList.remove('card-picker-trigger--empty');
  mountCardFace(trigger, card, 'card-picker-img');
}

export function setPreviewCardImage(preview: HTMLElement, card: Card): void {
  preview.className = 'picker-preview';
  mountCardFace(preview, card, 'picker-preview-img');
}
