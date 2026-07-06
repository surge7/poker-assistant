import type { PlayerStats } from './profiles';
import { VPIP_RANGE_NODES } from '../config/vpip-ranges';
import { topPercentHands } from '../config/hand-rankings';

/**
 * Перевод метрик игрока в диапазон рук.
 * Линейная интерполяция % диапазона по VPIP между узлами VPIP_RANGE_NODES,
 * затем топ-N% из 169 рук (hand-rankings.ts).
 *
 * ВНИМАНИЕ: упрощённая версия для рефактора. Полная реализация
 * (учёт PFR для сужения рейз-диапазона, обработка краёв VPIP<10 и >55) —
 * в фиче профилей игроков.
 */
export function statsToRange(stats: PlayerStats): readonly string[] {
  const rangePct = interpolateVpipToRange(stats.vpip);
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
