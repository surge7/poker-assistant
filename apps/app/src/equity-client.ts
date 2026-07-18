/**
 * Клиент для расчёта эквити через Web Worker (async) с fallback на sync.
 *
 * Worker грузится асинхронно через new Worker(URL). Если не загрузился
 * (single-HTML, Android WebView, отсутствие поддержки) — падаем на sync.
 *
 * Очередь запросов монотонна: stale результаты отбрасываются по id.
 */

import type { Card } from '@poker/core';
import { calcEquitySync } from './equity-fallback';

export interface EquityParams {
  holeCards: Card[];
  board: Card[];
  numOpponents: number;
  iterations: number;
}

export interface EquityResult {
  percent: number;
  low: number;
  high: number;
  isStale: boolean;
}

/** Клиент эквити: создаёт воркер, обрабатывает ошибки, отбрасывает stale. */
export class EquityClient {
  private worker: Worker | null = null;
  private disabled = false;
  private requestId = 0;
  private pending = new Map<number, { resolve: (r: EquityResult) => void; params: EquityParams }>();

  constructor(workerUrl: URL) {
    try {
      this.worker = new Worker(workerUrl, { type: 'module' });
      this.worker.addEventListener('error', () => this.disable());
      this.worker.addEventListener('messageerror', () => this.disable());
    } catch {
      this.disable();
    }
  }

  private disable(): void {
    if (this.disabled) return;
    this.disabled = true;
    if (this.worker) {
      try { this.worker.terminate(); } catch { /* noop */ }
      this.worker = null;
    }
    // Слить ожидающие запросы через sync, чтобы UI не завис.
    for (const [id, entry] of this.pending) {
      try {
        const r = calcEquitySync(entry.params.holeCards, entry.params.board, entry.params.numOpponents, entry.params.iterations);
        entry.resolve({ ...r, isStale: id !== this.requestId });
      } catch {
        entry.resolve({ percent: 0, low: 0, high: 0, isStale: id !== this.requestId });
      }
    }
    this.pending.clear();
  }

  /** Запросить эквити. Возвращает Promise с результатом и флагом isStale. */
  request(params: EquityParams): Promise<EquityResult> {
    const id = ++this.requestId;
    const checkStale = () => id !== this.requestId;

    if (!this.worker || this.disabled) {
      const r = calcEquitySync(params.holeCards, params.board, params.numOpponents, params.iterations);
      return Promise.resolve({ ...r, isStale: checkStale() });
    }

    try {
      this.worker.postMessage({ id, ...params });
    } catch {
      const r = calcEquitySync(params.holeCards, params.board, params.numOpponents, params.iterations);
      return Promise.resolve({ ...r, isStale: checkStale() });
    }

    return new Promise<EquityResult>((resolve) => {
      this.pending.set(id, { resolve, params });
      const onMessage = (e: MessageEvent) => {
        const data = e.data as { id: number; percent: number; low: number; high: number };
        if (data.id === id) {
          this.worker!.removeEventListener('message', onMessage);
          this.pending.delete(id);
          resolve({ percent: data.percent, low: data.low, high: data.high, isStale: checkStale() });
        }
      };
      this.worker!.addEventListener('message', onMessage);
    });
  }
}
