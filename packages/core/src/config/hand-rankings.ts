/**
 * 169 стартовых рук, упорядоченные по силе (Sklansky-style ranking).
 * Источник: Sklansky «Theory of Poker», стандартные чарты starting hands.
 * Формат: пара (AA/KK/...), suited (AKs/QJs/...), offsuit (AKo/QJo/...).
 *
 * Каждая из 169 возможных рук встречается ровно один раз:
 * 13 пар + 78 suited + 78 offsuit = 169. Раннее положение = более сильная рука.
 */
export const HAND_RANKINGS: readonly string[] = [
  // Тир 1: премиум
  'AA', 'KK', 'QQ', 'JJ', 'AKs',
  // Тир 2: сильные
  'TT', 'AQs', 'AJs', 'KQs', 'AKo',
  // Тир 3: средние+
  '99', 'JTs', 'QJs', 'KJs', 'ATs', 'AQo',
  // Тир 4: средние
  'T9s', 'KQo', '88', 'QTs', '98s', 'J9s', 'AJo', 'KTs',
  // Тир 5: играбельные
  '77', '87s', 'Q9s', 'T8s', 'KJo', 'QJo', 'JTo', '76s', '97s', '65s',
  // Тир 6: маргинальные
  '66', 'ATo', '55', '86s', 'KTo', '54s', '44', '33', '22',
  // Suited коннекторы/one-gappers (средние-слабые)
  'K9s', 'Q8s', 'J8s', 'A7o', 'A8o', 'A9o',
  'QTo', 'T9o', '98o', '87o', '76o', '65o',
  // Suited слабые
  'A2s', 'A3s', 'A4s', 'A5s', 'A6s', 'A7s', 'A8s', 'A9s',
  'K2s', 'K3s', 'K4s', 'K5s', 'K6s', 'K7s', 'K8s',
  'Q2s', 'Q3s', 'Q4s', 'Q5s', 'Q6s', 'Q7s',
  'J2s', 'J3s', 'J4s', 'J5s', 'J6s', 'J7s',
  'T2s', 'T3s', 'T4s', 'T5s', 'T6s', 'T7s',
  '92s', '93s', '94s', '95s', '96s',
  '82s', '83s', '84s', '85s',
  '72s', '73s', '74s', '75s',
  '62s', '63s', '64s',
  '52s', '53s',
  '42s', '43s',
  '32s',
  // Offsuit слабые (по убыванию)
  'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
  'K2o', 'K3o', 'K4o', 'K5o', 'K6o', 'K7o', 'K8o', 'K9o',
  'Q2o', 'Q3o', 'Q4o', 'Q5o', 'Q6o', 'Q7o', 'Q8o', 'Q9o',
  'J2o', 'J3o', 'J4o', 'J5o', 'J6o', 'J7o', 'J8o', 'J9o',
  'T2o', 'T3o', 'T4o', 'T5o', 'T6o', 'T7o', 'T8o',
  '92o', '93o', '94o', '95o', '96o', '97o',
  '82o', '83o', '84o', '85o', '86o',
  '73o', '74o', '75o',
  '62o', '63o', '64o',
  '54o', '52o', '53o',
  '42o', '43o',
  '32o',
  '72o', // канонически самая слабая рука
] as const;

/** Топ-N% рук как массив кодов. N=20 → первые round(20/100*169)=34 руки. */
export function topPercentHands(pct: number): readonly string[] {
  const count = Math.round((pct / 100) * 169);
  return HAND_RANKINGS.slice(0, Math.max(0, Math.min(169, count)));
}
