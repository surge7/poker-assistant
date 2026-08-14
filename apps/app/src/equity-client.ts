/**
 * Клиент для расчёта эквити через Web Worker (async) с fallback на sync.
 *
 * Worker грузится асинхронно через new Worker(URL). Если не загрузился
 * (single-HTML, Android WebView, отсутствие поддержки) — падаем на sync.
 *
 * Очередь запросов монотонна: stale результаты отбрасываются по id.
 * Watchdog: если воркер молчит дольше timeoutMs — переходим на sync,
 * чтобы UI не зависал на никогда не разрешающемся промисе.
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

/** Фабрика воркера — инъекция для тестов (по умолчанию new Worker). */
export type WorkerFactory = (workerUrl: URL) => Worker;

export interface EquityClientOptions {
  workerFactory?: WorkerFactory;
  /** Сколько мс ждать ответа воркера до перехода на sync. */
  timeoutMs?: number;
}

interface PendingEntry {
  resolve: (r: EquityResult) => void;
  params: EquityParams;
  timer?: ReturnType<typeof setTimeout>;
}

/** Таймаут ответа воркера по умолчанию. */
const DEFAULT_TIMEOUT_MS = 4000;

function defaultWorkerFactory(workerUrl: URL): Worker {
  return new Worker(workerUrl, { type: 'module' });
}

/** Клиент эквити: создаёт воркер, обрабатывает ошибки, отбрасывает stale. */
export class EquityClient {
  private worker: Worker | null = null;
  private disabled = false;
  private requestId = 0;
  private pending = new Map<number, PendingEntry>();

  constructor(workerUrl: URL, private options: EquityClientOptions = {}) {
    try {
      this.worker = (options.workerFactory ?? defaultWorkerFactory)(workerUrl);
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
      if (entry.timer) clearTimeout(entry.timer);
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

    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise<EquityResult>((resolve) => {
      const entry: PendingEntry = { resolve, params };
      this.pending.set(id, entry);
      entry.timer = setTimeout(() => this.disable(), timeoutMs);
      const onMessage = (e: MessageEvent) => {
        const data = e.data as { id: number; percent: number; low: number; high: number };
        if (data.id === id) {
          // После disable() (watchdog/error) воркер занулён — позднее
          // сообщение не должно падать с TypeError на removeEventListener.
          if (this.worker) this.worker.removeEventListener('message', onMessage);
          if (entry.timer) clearTimeout(entry.timer);
          this.pending.delete(id);
          resolve({ percent: data.percent, low: data.low, high: data.high, isStale: checkStale() });
        }
      };
      this.worker!.addEventListener('message', onMessage);
    });
  }
}
