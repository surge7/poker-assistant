/**
 * UI-state: применение сохранённого состояния, обновление чипов позиции,
 * debounced save, переключение режима скрытия руки.
 *
 * Зависит от state.ts (loadState/saveState) и picker.ts (setSlotCard).
 */

import { loadState, saveState, type AppState } from './state';
import { setSlotCard } from './picker';
import { clampNumPlayers, clampPositionIndex, getPositionHelpHtml, getTablePositions, type TablePosition } from '@poker/core';

/** Прочитать число из input: parseFloat с clamp от 0, округление до 2 знаков. */
export function parseAmount(input: HTMLInputElement): number {
  const v = parseFloat(input.value);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.round(v * 100) / 100;
}

/** Применить режим скрытия руки: атрибут на корне + переключение иконки. */
export function applyHandHidden(app: HTMLElement, hidden: boolean): void {
  app.setAttribute('data-hand-hidden', String(hidden));
  const iconVisible = document.querySelector('.hand-toggle-icon--visible') as HTMLElement | null;
  const iconHidden = document.querySelector('.hand-toggle-icon--hidden') as HTMLElement | null;
  const btn = document.getElementById('hand-toggle');
  if (iconVisible) iconVisible.hidden = hidden;
  if (iconHidden) iconHidden.hidden = !hidden;
  if (btn) btn.setAttribute('aria-pressed', String(hidden));
}

/** Обновить чипы позиции и подсказку под выбранное число игроков. */
export function updatePositionUI(
  numPlayers: number,
  positionChipsRow: HTMLElement,
  positionInput: HTMLInputElement,
  positionHelpPopover: HTMLElement,
  selectedIndex?: number,
): void {
  const n = clampNumPlayers(numPlayers);
  const current = selectedIndex ?? (parseInt(positionInput.value, 10) || 0);
  const clamped = clampPositionIndex(current, n);
  positionInput.value = String(clamped);

  const positions = getTablePositions(n);
  positionChipsRow.innerHTML = positions
    .map(
      (p: TablePosition) =>
        `<button type="button" class="position-chip${p.index === clamped ? ' position-chip--active' : ''}" data-position="${p.index}">${p.name}</button>`
    )
    .join('');

  positionHelpPopover.innerHTML = getPositionHelpHtml(n);
}

/** Собрать текущее состояние из DOM. */
export function readStateFromDom(positionInput: HTMLInputElement): AppState {
  const holeCards: AppState['holeCards'] = [null, null];
  for (let i = 0; i < 2; i++) {
    const rv = (document.getElementById(`hole-rank-${i}`) as HTMLSelectElement | null)?.value;
    const sv = (document.getElementById(`hole-suit-${i}`) as HTMLSelectElement | null)?.value;
    if (rv && sv) holeCards[i] = (rv + sv) as AppState['holeCards'][0];
  }
  const boardCards: AppState['boardCards'] = [null, null, null, null, null];
  for (let i = 0; i < 5; i++) {
    const rv = (document.getElementById(`board-rank-${i}`) as HTMLSelectElement | null)?.value;
    const sv = (document.getElementById(`board-suit-${i}`) as HTMLSelectElement | null)?.value;
    if (rv && sv) boardCards[i] = (rv + sv) as AppState['boardCards'][0];
  }
  const numPlayers = parseInt((document.getElementById('num-players') as HTMLInputElement).value, 10) || 6;
  const potEl = document.getElementById('pot-size') as HTMLInputElement;
  const callEl = document.getElementById('to-call') as HTMLInputElement;
  const app = document.getElementById('app');
  return {
    version: 1,
    holeCards,
    boardCards,
    position: parseInt(positionInput.value, 10) || 0,
    numPlayers,
    potSize: parseAmount(potEl),
    toCall: parseAmount(callEl),
    handHidden: app?.getAttribute('data-hand-hidden') === 'true',
  };
}

/** Применить состояние к DOM: восстановить карты, позицию, банк/колл, скрытие руки. */
export function applyState(state: AppState, app: HTMLElement): void {
  for (let i = 0; i < 2; i++) setSlotCard(i, state.holeCards[i]);
  for (let i = 0; i < 5; i++) setSlotCard(i + 2, state.boardCards[i]);

  (document.getElementById('num-players') as HTMLInputElement).value = String(state.numPlayers);
  document.querySelectorAll('.player-chip').forEach((c) => {
    c.classList.toggle('player-chip--active', c.getAttribute('data-players') === String(state.numPlayers));
  });

  const positionInput = document.getElementById('position') as HTMLInputElement;
  const positionChipsRow = document.getElementById('position-chips-row') as HTMLElement;
  const positionHelpPopover = document.getElementById('position-help-popover') as HTMLElement;
  updatePositionUI(state.numPlayers, positionChipsRow, positionInput, positionHelpPopover, state.position);

  (document.getElementById('pot-size') as HTMLInputElement).value = String(state.potSize);
  (document.getElementById('to-call') as HTMLInputElement).value = String(state.toCall);

  applyHandHidden(app, state.handHidden);
}

/** Создать debounced saver (300мс) — для сохранения состояния при изменениях. */
export function createDebouncedSave(positionInput: HTMLInputElement, delayMs = 300): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      saveState(readStateFromDom(positionInput));
    }, delayMs);
  };
}

/** Загрузить сохранённое состояние (или null, если нет). */
export { loadState };
