import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultState, saveState, loadState, clearState, type AppState } from './state';

describe('state persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    clearState();
  });

  // Аннотация AppState нужна, чтобы holeCards вывелся кортежем, а не string[].
  it('roundtrips a valid state through localStorage', () => {
    const s: AppState = { ...getDefaultState(), holeCards: ['As', 'Kd'], potSize: 100 };
    saveState(s);
    expect(loadState()).toEqual(s);
  });

  it('returns null when nothing is stored', () => {
    expect(loadState()).toBeNull();
  });

  it('rejects corrupted JSON', () => {
    localStorage.setItem('poker-assistant:state:v1', '{not json');
    expect(loadState()).toBeNull();
  });

  it('rejects wrong version', () => {
    const s = { ...getDefaultState(), version: 2 };
    localStorage.setItem('poker-assistant:state:v1', JSON.stringify(s));
    expect(loadState()).toBeNull();
  });

  it('rejects invalid cards', () => {
    const s = { ...getDefaultState(), holeCards: ['ZZ', null] };
    localStorage.setItem('poker-assistant:state:v1', JSON.stringify(s));
    expect(loadState()).toBeNull();
  });

  it('rejects wrong field types', () => {
    const s = { ...getDefaultState(), numPlayers: 'six' };
    localStorage.setItem('poker-assistant:state:v1', JSON.stringify(s));
    expect(loadState()).toBeNull();
  });

  it('clearState removes stored state', () => {
    saveState(getDefaultState());
    clearState();
    expect(loadState()).toBeNull();
  });
});
