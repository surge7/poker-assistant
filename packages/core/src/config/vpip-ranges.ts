/**
 * Узлы интерполяции: VPIP → процент рук, которые игрок обычно разыгрывает.
 * Между узлами — линейная интерполяция. Числа — настраиваемые оценки
 * по типичным стилям игры (нит/TAG/LAG/фиш).
 */
export const VPIP_RANGE_NODES: readonly { vpip: number; rangePct: number }[] = [
  { vpip: 10, rangePct: 15 }, // нит: топ-15%
  { vpip: 20, rangePct: 25 }, // TAG
  { vpip: 35, rangePct: 45 }, // LAG
  { vpip: 55, rangePct: 65 }, // фиш
] as const;
