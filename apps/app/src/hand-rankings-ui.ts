import type { Card } from '@poker/core';
import { cardToHtml } from './cards';

interface HandRankingEntry {
  order: number;
  name: string;
  description: string;
  example: Card[];
}

const HAND_RANKINGS_RU: HandRankingEntry[] = [
  { order: 1, name: 'Роял-флеш', description: 'A–K–Q–J–10 одной масти', example: ['Ah', 'Kh', 'Qh', 'Jh', 'Th'] },
  { order: 2, name: 'Стрит-флеш', description: 'Пять подряд одной масти', example: ['6s', '7s', '8s', '9s', 'Ts'] },
  { order: 3, name: 'Каре', description: 'Четыре одного ранга', example: ['Th', 'Ts', 'Td', 'Tc', 'Ad'] },
  { order: 4, name: 'Фулл-хаус', description: 'Тройка и пара', example: ['Ac', 'Ad', 'As', 'Kd', 'Kc'] },
  { order: 5, name: 'Флеш', description: 'Пять одной масти', example: ['As', 'Js', '7s', '5s', '2s'] },
  { order: 6, name: 'Стрит', description: 'Пять карт подряд', example: ['4s', '5h', '6s', '7h', '8s'] },
  { order: 7, name: 'Сет', description: 'Три одного ранга', example: ['8h', '8s', '8d', 'As', '4h'] },
  { order: 8, name: 'Две пары', description: 'Две пары рангов', example: ['As', 'Ah', 'Ks', 'Kh', '2s'] },
  { order: 9, name: 'Пара', description: 'Две одного ранга', example: ['Jh', 'Js', '5h', '7s', '2h'] },
  { order: 10, name: 'Старшая карта', description: 'Без комбинации', example: ['Qs', 'Jh', '6s', '4h', '3s'] },
];

function renderCards(cards: Card[]): string {
  return cards.map((c) => cardToHtml(c, 'hr-card-img')).join('');
}

function renderRow(entry: HandRankingEntry): string {
  return `
    <article class="hr-row">
      <div class="hr-rank-badge" aria-label="Место ${entry.order}">
        <span class="hr-rank-num">${entry.order}</span>
      </div>
      <div class="hr-cards">${renderCards(entry.example)}</div>
      <div class="hr-text">
        <h3 class="hr-name">${entry.name}</h3>
        <p class="hr-desc">${entry.description}</p>
      </div>
    </article>`;
}

let overlayEl: HTMLElement | null = null;
let previousOverflow = '';

function closePanel(): void {
  if (!overlayEl) return;
  overlayEl.classList.remove('rankings-overlay--open');
  document.body.style.overflow = previousOverflow;
  document.removeEventListener('keydown', onKeyDown);
  const remove = () => {
    overlayEl?.remove();
    overlayEl = null;
  };
  overlayEl.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, 350);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closePanel();
}

/** Открыть полноэкранную таблицу комбинаций. */
export function openHandRankingsPanel(): void {
  if (overlayEl) return;

  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  overlayEl = document.createElement('div');
  overlayEl.className = 'rankings-overlay';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.setAttribute('aria-label', 'Таблица покерных комбинаций');

  overlayEl.innerHTML = `
    <div class="rankings-panel">
      <div class="rankings-frame" aria-hidden="true"></div>
      <header class="rankings-header">
        <div class="rankings-header-glow" aria-hidden="true"></div>
        <div class="rankings-title-block">
          <span class="rankings-eyebrow">Texas Hold'em</span>
          <h2 class="rankings-title">Комбинации</h2>
        </div>
        <p class="rankings-subtitle">Сильнейшая → слабейшая</p>
        <button type="button" class="rankings-close btn-ripple" aria-label="Закрыть">×</button>
      </header>
      <div class="rankings-list">
        ${HAND_RANKINGS_RU.map(renderRow).join('')}
      </div>
    </div>
  `;

  document.body.append(overlayEl);
  document.addEventListener('keydown', onKeyDown);

  overlayEl.querySelector('.rankings-close')?.addEventListener('click', closePanel);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closePanel();
  });

  requestAnimationFrame(() => overlayEl?.classList.add('rankings-overlay--open'));
}

/** SVG-иконка для кнопки в шапке. */
export function handRankingsButtonIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="13" height="17" rx="2"/><rect x="8" y="3" width="13" height="17" rx="2"/><path d="M11 9h2M11 12h2M11 15h2"/></svg>`;
}
