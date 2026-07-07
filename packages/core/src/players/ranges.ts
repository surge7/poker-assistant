import type { PlayerStats } from './profiles';
import { VPIP_RANGE_NODES } from '../config/vpip-ranges';
import { topPercentHands } from '../config/hand-rankings';

/**
 * Перевод метрик игрока в диапазон рук.
 * Линейная интерполяция % диапазона по VPIP между узлами VPIP_RANGE_NODES,
 * затем топ-N% из 169 рук (hand-rankings.ts).
 *
 * При vpip<=0 (неизвестный игрок) возвращает пустой массив — это сигнал для
 * equity «раздать случайную руку из всей колоды». Согласовано с raiseFactor()
 * из profiles.ts, который тоже трактует vpip<=0 как «нет данных».
 */
export function statsToRange(stats: PlayerStats): readonly string[] {
  if (stats.vpip <= 0) return [];
  const rangePct = interpolateVpipToRange(clamp(stats.vpip, 0, 100));
  return topPercentHands(rangePct);
}

/** Линейная интерполяция между узлами VPIP_RANGE_NODES. Вне диапазона узлов — клиппинг. */
function interpolateVpipToRange(vpip: number): number {
  const nodes = VPIP_RANGE_NODES;
  if (vpip <= nodes[0].vpip) return nodes[0].rangePct;
  if (vpip >= nodes[nodes.length - 1].vpip) return nodes[nodes.length - 1].rangePct;
  for (let i = 1; i < nodes.length; i++) {
    if (vpip <= nodes[i].vpip) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const t = (vpip - prev.vpip) / (curr.vpip - prev.vpip);
      return prev.rangePct + t * (curr.rangePct - prev.rangePct);
    }
  }
  return nodes[nodes.length - 1].rangePct;
}

/** Ограничение значения диапазоном [min; max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
