/**
 * Предустановленные типы игроков с типичными VPIP/PFR.
 * Значения — стандартные оценки из покерной литературы.
 * Используются как быстрые пресеты в UI и как эталоны в тестах.
 */

export type PlayerPresetKey = 'unknown' | 'nit' | 'tag' | 'lag' | 'fish' | 'maniac';

export interface PlayerPreset {
  key: PlayerPresetKey;
  label: string;        // для UI
  description: string;  // краткое описание стиля
  vpip: number;
  pfr: number;
}

export const PLAYER_PRESETS: readonly PlayerPreset[] = [
  { key: 'unknown', label: 'Неизвестен', description: 'Случайная рука (нет данных)', vpip: 0, pfr: 0 },
  { key: 'nit', label: 'Нит', description: 'Тайтовый-пассивный, играет только премиум', vpip: 12, pfr: 10 },
  { key: 'tag', label: 'TAG', description: 'Тайтовый-агрессивный, оптимальный стиль', vpip: 22, pfr: 18 },
  { key: 'lag', label: 'LAG', description: 'Лузовый-агрессивный, много рейзов', vpip: 35, pfr: 28 },
  { key: 'fish', label: 'Фиш', description: 'Лузовый-пассивный, коллирует всё', vpip: 50, pfr: 8 },
  { key: 'maniac', label: 'Маньяк', description: 'Сверхагрессивный, блефует много', vpip: 60, pfr: 45 },
] as const;

/** Получить пресет по ключу. unknown для некорректного ключа. */
export function getPreset(key: PlayerPresetKey): PlayerPreset {
  return PLAYER_PRESETS.find((p) => p.key === key) ?? PLAYER_PRESETS[0];
}
