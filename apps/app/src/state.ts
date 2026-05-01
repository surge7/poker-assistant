import type { Card } from '@poker/core';

export interface AppState {
  version: 1;
  holeCards: [Card | null, Card | null];
  boardCards: [Card | null, Card | null, Card | null, Card | null, Card | null];
  position: number;
  numPlayers: number;
  potSize: number;
  toCall: number;
}

const STORAGE_KEY = 'poker-assistant:state:v1';

// In-memory fallback for when localStorage is unavailable
let inMemoryState: AppState | null = null;
let storageAvailable = true;

function checkStorage(): boolean {
  if (!storageAvailable) return false;
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
    return true;
  } catch {
    storageAvailable = false;
    return false;
  }
}

function isValidCard(v: unknown): v is Card | null {
  if (v === null) return true;
  if (typeof v !== 'string' || v.length !== 2) return false;
  const ranks = '23456789TJQKA';
  const suits = 'shdc';
  return ranks.includes(v[0]) && suits.includes(v[1]);
}

function isValidState(obj: unknown): obj is AppState {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  if (s.version !== 1) return false;
  if (!Array.isArray(s.holeCards) || s.holeCards.length !== 2) return false;
  if (!Array.isArray(s.boardCards) || s.boardCards.length !== 5) return false;
  if (!s.holeCards.every(isValidCard)) return false;
  if (!s.boardCards.every(isValidCard)) return false;
  if (typeof s.position !== 'number') return false;
  if (typeof s.numPlayers !== 'number') return false;
  if (typeof s.potSize !== 'number') return false;
  if (typeof s.toCall !== 'number') return false;
  return true;
}

export function getDefaultState(): AppState {
  return {
    version: 1,
    holeCards: [null, null],
    boardCards: [null, null, null, null, null],
    position: 0,
    numPlayers: 6,
    potSize: 0,
    toCall: 0,
  };
}

export function loadState(): AppState | null {
  // Try localStorage first
  if (checkStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  }
  // Fallback to in-memory
  return inMemoryState;
}

export function saveState(state: AppState): void {
  if (checkStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return;
    } catch {
      storageAvailable = false;
    }
  }
  // Fallback: store in memory
  inMemoryState = state;
}

export function clearState(): void {
  inMemoryState = null;
  if (checkStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
