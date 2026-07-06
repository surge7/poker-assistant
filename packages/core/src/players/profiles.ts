/**
 * Модель оппонента для будущей фичи профилей игроков.
 * VPIP/PFR — стандартные покерные метрики (0..100).
 */

/** Числовые метрики оппонента. */
export interface PlayerStats {
  /** VPIP — добровольно вложенные деньги на префлопе, 0..100. Мера лузовости. */
  vpip: number;
  /** PFR — префлоп-рейз, 0..100. Мера агрессии на префлопе. */
  pfr: number;
}

/** Один оппонент за столом с его статистикой. */
export interface Opponent {
  /** Позиция за столом (тот же индекс, что в strategy/positions.ts). */
  position: number;
  /** Метрики, если известны. undefined = неизвестный оппонент (случайная рука). */
  stats?: PlayerStats;
}

/**
 * Агрессивность как отношение PFR/VPIP (raise factor).
 * Высокое значение = игрок чаще открывается рейзом, а не коллом.
 * При VPIP<=0 возвращает 0 (нет данных).
 */
export function raiseFactor(stats: PlayerStats): number {
  if (stats.vpip <= 0) return 0;
  return stats.pfr / stats.vpip;
}
