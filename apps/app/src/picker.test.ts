import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildCardSelects,
  buildBoardCardSelects,
  setSlotCard,
  getSlotCard,
  removeDuplicateCards,
  readCardSelects,
} from './picker';

describe('picker', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="hole"></div><div id="board"></div>';
  });

  it('builds 2 hole slots and 5 board slots', () => {
    buildCardSelects(document.getElementById('hole')!, 2, 'hole');
    buildBoardCardSelects(document.getElementById('board')!);
    expect(document.getElementById('hole-rank-0')).toBeTruthy();
    expect(document.getElementById('hole-rank-1')).toBeTruthy();
    expect(document.getElementById('board-rank-4')).toBeTruthy();
  });

  it('setSlotCard/getSlotCard roundtrip', () => {
    buildCardSelects(document.getElementById('hole')!, 2, 'hole');
    setSlotCard(0, 'As');
    expect(getSlotCard(0)).toBe('As');
    setSlotCard(0, null);
    expect(getSlotCard(0)).toBeNull();
  });

  it('removeDuplicateCards keeps first occurrence, clears later duplicates', () => {
    buildCardSelects(document.getElementById('hole')!, 2, 'hole');
    buildBoardCardSelects(document.getElementById('board')!);
    setSlotCard(0, 'As');
    setSlotCard(1, 'As');
    setSlotCard(2, 'Kd');
    removeDuplicateCards();
    expect(getSlotCard(0)).toBe('As');
    expect(getSlotCard(1)).toBeNull();
    expect(getSlotCard(2)).toBe('Kd');
  });

  it('readCardSelects returns only fully selected cards', () => {
    buildBoardCardSelects(document.getElementById('board')!);
    setSlotCard(2, '7c'); // слот 2 глобальный = board-0
    expect(readCardSelects(document.getElementById('board')!, 'board')).toEqual(['7c']);
  });
});
