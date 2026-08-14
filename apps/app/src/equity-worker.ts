/**
 * Web Worker для расчёта эквити (Монте-Карло).
 * Выносит тяжёлый синхронный расчёт в отдельный поток — UI не блокируется.
 *
 * Контракт:
 *   запрос:  { id, holeCards, board, numOpponents, iterations }
 *   ответ:   { id, percent, low, high }
 * id — монотонный, для отмены устаревших расчётов на стороне main-потока.
 */
import { equityPercentRange, type Card } from '@poker/core';

export interface EquityRequest {
  id: number;
  holeCards: Card[];
  board: Card[];
  numOpponents: number;
  iterations: number;
}

export interface EquityResponse {
  id: number;
  percent: number;
  low: number;
  high: number;
}

self.onmessage = (e: MessageEvent<EquityRequest>) => {
  const { id, holeCards, board, numOpponents, iterations } = e.data;
  try {
    const result = equityPercentRange(holeCards, board, numOpponents, iterations);
    const response: EquityResponse = { id, ...result };
    (self as unknown as Worker).postMessage(response);
  } catch {
    // При ошибке — возвращаем id с нулевым результатом, чтобы main-поток не завис.
    const response: EquityResponse = { id, percent: 0, low: 0, high: 0 };
    (self as unknown as Worker).postMessage(response);
  }
};
