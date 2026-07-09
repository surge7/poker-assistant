/**
 * Синхронный fallback для расчёта эквити.
 * Используется, когда Web Worker недоступен: portable-режим (IIFE, без Worker),
 * Android WebView (если Worker не грузится), или старые браузеры.
 *
 * Вынесен в отдельный модуль, чтобы Vite не вырезал equityPercentRange
 * при tree-shaking (в основном бандле функция нужна для fallback-ветки).
 */
import { equityPercentRange, type Card } from '@poker/core';

export function calcEquitySync(
  holeCards: Card[],
  board: Card[],
  numOpponents: number,
  iterations: number,
): { percent: number; low: number; high: number } {
  return equityPercentRange(holeCards, board, numOpponents, iterations);
}
