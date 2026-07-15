/**
 * Card picker — компонент выбора карт.
 *
 * Структура DOM для одного слота:
 * - hidden <select rank> + <select suit>: data-канал, программная установка и read
 * - <button class="trigger">: видимая «закрытая» карта
 * - <div class="popover" hidden>: сетка рангов и мастей + Done/Clear
 *
 * Слоты нумеруются 0..6: 0..1 — рука, 2..6 — борд. Для руки idPrefix='hole',
 * для борда — 'board'.
 */

import { selectionChanged, impactLight } from './haptics';
import type { Card } from '@poker/core';
import { setPreviewCardImage, setTriggerCardImage } from './cards';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
const SUITS = ['s', 'h', 'd', 'c'] as const;

/** Подписи для старших карт в выпадающем списке. */
const RANK_LABELS: Record<string, string> = {
  T: '10',
  J: 'J (валет)',
  Q: 'Q (дама)',
  K: 'K (король)',
  A: 'A (туз)',
};

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

/** Отображаемое имя и значение ранга (для попапа). 10↔T. */
const RANK_DISPLAY = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const RANK_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T',  'J', 'Q', 'K'] as const;

const SUIT_DATA = [
  { suit: 's', symbol: '♠', label: 'Пики' },
  { suit: 'h', symbol: '♥', label: 'Червы' },
  { suit: 'd', symbol: '♦', label: 'Бубны' },
  { suit: 'c', symbol: '♣', label: 'Трефы' },
] as const;

/** HTML для <option>. */
function renderCardOption(value: string, label: string): string {
  return `<option value="${value}">${label}</option>`;
}

/** Обновить отображение триггера пикера по значениям в select. */
function updatePickerDisplay(idPrefix: string, slotIndex: number): void {
  const rankEl = document.getElementById(`${idPrefix}-rank-${slotIndex}`) as HTMLSelectElement | null;
  const suitEl = document.getElementById(`${idPrefix}-suit-${slotIndex}`) as HTMLSelectElement | null;
  const trigger = document.getElementById(`${idPrefix}-trigger-${slotIndex}`);
  if (!rankEl || !suitEl || !trigger) return;
  const r = rankEl.value;
  const s = suitEl.value;
  const card = r && s ? ((r + s) as Card) : null;
  setTriggerCardImage(trigger, card);
}

/** Карты, выбранные во всех слотах кроме указанного (для отключения в сетке). */
function getSelectedCardsExcept(skipSlotIndex: number): Set<string> {
  const set = new Set<string>();
  for (let idx = 0; idx < 7; idx++) {
    if (idx === skipSlotIndex) continue;
    const card = getSlotCard(idx);
    if (card) set.add(card);
  }
  return set;
}

/** Слот выбора карты: скрытые select + триггер + попап с сеткой карт. */
function buildCardPickerSlot(
  container: HTMLElement,
  slotIndex: number,
  idPrefix: string,
  isBoard: boolean,
  label?: string,
): void {
  const wrap = document.createElement('div');
  wrap.className = isBoard ? 'board-card card-picker-wrap' : 'card-picker-wrap';
  wrap.dataset.slotIndex = String(slotIndex);
  wrap.dataset.idPrefix = idPrefix;

  const rank = document.createElement('select');
  rank.id = `${idPrefix}-rank-${slotIndex}`;
  rank.className = 'card-picker-select';
  rank.setAttribute('aria-hidden', 'true');
  rank.innerHTML = '<option value="">—</option>' + RANKS.map((r) => renderCardOption(r, RANK_LABELS[r] ?? r)).join('');

  const suit = document.createElement('select');
  suit.id = `${idPrefix}-suit-${slotIndex}`;
  suit.className = 'card-picker-select';
  suit.setAttribute('aria-hidden', 'true');
  suit.innerHTML =
    '<option value="">—</option>' +
    SUITS.map((s) => renderCardOption(s, SUIT_SYMBOLS[s])).join('');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'card-picker-trigger card-picker-trigger--empty';
  trigger.id = `${idPrefix}-trigger-${slotIndex}`;
  trigger.textContent = '—';
  trigger.setAttribute('aria-label', label ? `Выбрать карту: ${label}` : `Выбрать карту ${slotIndex + 1}`);

  const popover = document.createElement('div');
  popover.className = 'card-picker-popover';
  popover.hidden = true;
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Выбор карты');

  const preview = document.createElement('div');
  preview.className = 'picker-preview';
  preview.textContent = '—';

  const rankRow = document.createElement('div');
  rankRow.className = 'picker-rank-row';
  RANK_DISPLAY.forEach((labelText, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'picker-rank-chip';
    chip.textContent = labelText;
    chip.dataset.rank = RANK_VALUES[i];
    rankRow.append(chip);
  });

  const suitRow = document.createElement('div');
  suitRow.className = 'picker-suit-row';
  SUIT_DATA.forEach(({ suit: s, symbol, label: sLabel }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `picker-suit-btn${s === 'h' || s === 'd' ? ' picker-suit-btn--red' : ''}`;
    btn.dataset.suit = s;
    btn.setAttribute('aria-label', sLabel);
    btn.textContent = symbol;
    suitRow.append(btn);
  });

  const footer = document.createElement('div');
  footer.className = 'picker-footer';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'picker-btn picker-btn--secondary';
  clearBtn.textContent = 'Очистить';
  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'picker-btn picker-btn--primary';
  doneBtn.textContent = 'Готово';
  doneBtn.disabled = true;
  footer.append(clearBtn, doneBtn);

  popover.append(preview, rankRow, suitRow, footer);

  let pendingRank = rank.value || '';
  let pendingSuit = suit.value || '';

  function updatePreview(): void {
    if (pendingRank && pendingSuit) {
      const card = (pendingRank + pendingSuit) as Card;
      setPreviewCardImage(preview, card);
      doneBtn.disabled = false;
    } else if (pendingRank) {
      preview.textContent = pendingRank === 'T' ? '10' : pendingRank;
      preview.className = 'picker-preview';
      doneBtn.disabled = true;
    } else {
      preview.textContent = '—';
      preview.className = 'picker-preview';
      doneBtn.disabled = true;
    }

    preview.classList.remove('animate-scale-in');
    void preview.offsetWidth;
    if (pendingRank && pendingSuit) {
      preview.classList.add('animate-scale-in');
    }
  }

  function setActiveRank(r: string): void {
    rankRow.querySelectorAll<HTMLButtonElement>('.picker-rank-chip').forEach((c) => {
      c.classList.toggle('picker-rank-chip--active', c.dataset.rank === r);
    });
  }

  function setActiveSuit(s: string): void {
    suitRow.querySelectorAll<HTMLButtonElement>('.picker-suit-btn').forEach((b) => {
      b.classList.toggle('picker-suit-btn--active', b.dataset.suit === s);
    });
  }

  if (rank.value) { pendingRank = rank.value; setActiveRank(rank.value); }
  if (suit.value) { pendingSuit = suit.value; setActiveSuit(suit.value); }
  updatePreview();

  wrap.append(rank, suit, trigger, popover);

  function openPopover(): void {
    // Закрыть все остальные открытые попапы — одновременно открыт только один.
    document.querySelectorAll<HTMLElement>('.card-picker-popover').forEach((p) => {
      if (p !== popover) p.hidden = true;
    });

    pendingRank = rank.value || '';
    pendingSuit = suit.value || '';
    setActiveRank(pendingRank);
    setActiveSuit(pendingSuit);
    updatePreview();

    rankRow.querySelectorAll<HTMLButtonElement>('.picker-rank-chip').forEach((chip) => {
      chip.disabled = false;
    });
    suitRow.querySelectorAll<HTMLButtonElement>('.picker-suit-btn').forEach((btn) => {
      btn.disabled = false;
    });

    const rect = trigger.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 4}px`;
    popover.hidden = false;
  }

  function closePopover(): void {
    popover.hidden = true;
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover.hidden) openPopover();
    else closePopover();
  });

  rankRow.querySelectorAll<HTMLButtonElement>('.picker-rank-chip').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (chip.disabled) return;
      pendingRank = chip.dataset.rank ?? '';
      setActiveRank(pendingRank);
      const taken = getSelectedCardsExcept(idPrefix === 'hole' ? slotIndex : slotIndex + 2);
      suitRow.querySelectorAll<HTMLButtonElement>('.picker-suit-btn').forEach((btn) => {
        const card = (pendingRank + (btn.dataset.suit ?? '')) as Card;
        btn.disabled = taken.has(card);
      });
      updatePreview();
      selectionChanged();
    });
  });

  suitRow.querySelectorAll<HTMLButtonElement>('.picker-suit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      pendingSuit = btn.dataset.suit ?? '';
      setActiveSuit(pendingSuit);
      updatePreview();
      selectionChanged();
    });
  });

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    pendingRank = '';
    pendingSuit = '';
    setActiveRank('');
    setActiveSuit('');
    updatePreview();
  });

  doneBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!pendingRank || !pendingSuit) return;
    rank.value = pendingRank;
    suit.value = pendingSuit;
    rank.dispatchEvent(new Event('change', { bubbles: true }));
    suit.dispatchEvent(new Event('change', { bubbles: true }));
    updatePickerDisplay(idPrefix, slotIndex);
    impactLight();
    closePopover();
  });

  rank.addEventListener('change', () => updatePickerDisplay(idPrefix, slotIndex));
  suit.addEventListener('change', () => updatePickerDisplay(idPrefix, slotIndex));

  document.addEventListener('click', (e) => {
    if (!popover.hidden && !wrap.contains(e.target as Node)) closePopover();
  });

  if (label) {
    const item = document.createElement('div');
    item.className = 'hole-card-item';
    const labelEl = document.createElement('span');
    labelEl.className = 'hole-card-label';
    labelEl.textContent = label;
    item.append(labelEl, wrap);
    container.append(item);
  } else {
    container.append(wrap);
  }
}

/** Создать N слотов выбора карт (для руки). */
export function buildCardSelects(
  container: HTMLElement,
  count: number,
  idPrefix: string,
  labels?: string[],
): void {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    buildCardPickerSlot(container, i, idPrefix, false, labels?.[i]);
  }
}

/** Борд: 5 карт, каждая — пикер с сеткой. */
export function buildBoardCardSelects(container: HTMLElement): void {
  container.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    buildCardPickerSlot(container, i, 'board', true);
  }
}

/** Прочитать выбранные карты из idPrefix-слотов. */
export function readCardSelects(container: HTMLElement, idPrefix: string): Card[] {
  const cards: Card[] = [];
  let i = 0;
  while (true) {
    const rankEl = document.getElementById(`${idPrefix}-rank-${i}`) as HTMLSelectElement | null;
    const suitEl = document.getElementById(`${idPrefix}-suit-${i}`) as HTMLSelectElement | null;
    if (!rankEl || !suitEl) break;
    const r = rankEl.value;
    const s = suitEl.value;
    if (r && s) cards.push((r + s) as Card);
    i++;
  }
  return cards;
}

/**
 * Карта в слоте (0..6) или null. Валидирует ранг/масть: невалидное значение
 * (программная установка, copy-paste) трактуется как пустое, а не как мусор.
 */
export function getSlotCard(slotIndex: number): Card | null {
  const idPrefix = slotIndex < 2 ? 'hole' : 'board';
  const i = slotIndex < 2 ? slotIndex : slotIndex - 2;
  const rankEl = document.getElementById(`${idPrefix}-rank-${i}`) as HTMLSelectElement | null;
  const suitEl = document.getElementById(`${idPrefix}-suit-${i}`) as HTMLSelectElement | null;
  if (!rankEl || !suitEl) return null;
  const r = rankEl.value;
  const s = suitEl.value;
  if (!r || !s) return null;
  if (!RANKS.includes(r as typeof RANKS[number]) || !SUITS.includes(s as typeof SUITS[number])) return null;
  return (r + s) as Card;
}

/** Очистить слот. */
export function clearSlot(slotIndex: number): void {
  const idPrefix = slotIndex < 2 ? 'hole' : 'board';
  const i = slotIndex < 2 ? slotIndex : slotIndex - 2;
  const rankEl = document.getElementById(`${idPrefix}-rank-${i}`) as HTMLSelectElement | null;
  const suitEl = document.getElementById(`${idPrefix}-suit-${i}`) as HTMLSelectElement | null;
  if (rankEl) rankEl.value = '';
  if (suitEl) {
    suitEl.value = '';
    suitEl.classList.remove('suit-red', 'suit-black');
    if (slotIndex >= 2) {
      const cardWrap = suitEl.closest('.board-card');
      if (cardWrap) cardWrap.classList.remove('board-card--red-suit', 'board-card--black-suit');
    }
  }
  updatePickerDisplay(idPrefix, i);
}

/** Убрать дубликаты: одинаковая карта в нескольких слотах → оставить только в первом. */
export function removeDuplicateCards(): void {
  const slots: (Card | null)[] = [];
  for (let idx = 0; idx < 7; idx++) slots.push(getSlotCard(idx));
  for (let i = 0; i < 7; i++) {
    if (!slots[i]) continue;
    for (let j = i + 1; j < 7; j++) {
      if (slots[j] === slots[i]) {
        clearSlot(j);
        slots[j] = null;
      }
    }
  }
}

/** Подключить проверку на дубликаты ко всем select'ам карт. */
export function attachDuplicateCheck(): void {
  const selectors: string[] = [];
  for (let i = 0; i < 2; i++) selectors.push(`#hole-rank-${i}`, `#hole-suit-${i}`);
  for (let i = 0; i < 5; i++) selectors.push(`#board-rank-${i}`, `#board-suit-${i}`);
  for (const sel of selectors) {
    const el = document.querySelector(sel) as HTMLSelectElement | null;
    if (el) el.addEventListener('change', removeDuplicateCards);
  }
}

/** Программно установить значение слота (для восстановления состояния). */
export function setSlotCard(slotIndex: number, card: Card | null): void {
  const idPrefix = slotIndex < 2 ? 'hole' : 'board';
  const i = slotIndex < 2 ? slotIndex : slotIndex - 2;
  const rankEl = document.getElementById(`${idPrefix}-rank-${i}`) as HTMLSelectElement | null;
  const suitEl = document.getElementById(`${idPrefix}-suit-${i}`) as HTMLSelectElement | null;
  if (!rankEl || !suitEl) return;
  rankEl.value = card ? card[0] : '';
  suitEl.value = card ? card[1] : '';
  rankEl.dispatchEvent(new Event('change', { bubbles: true }));
  suitEl.dispatchEvent(new Event('change', { bubbles: true }));
  updatePickerDisplay(idPrefix, i);
}
