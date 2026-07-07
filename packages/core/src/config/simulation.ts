/** Итерации Монте-Карло. Больше итераций → меньше дисперсия, дольше расчёт. */
export const DEFAULT_ITERATIONS = 2000;
export const PREFLOP_ITERATIONS = 3000; // больше неизвестных карт → выше дисперсия
export const POSTFLOP_ITERATIONS = 2000;

/**
 * Уменьшенные итерации для интерактивного (автоматического) пересчёта при вводе карт.
 * Дают более грубую оценку (~±5%), но расчёт в 4-6 раз быстрее — UI отзывчив.
 * Точный расчёт (DEFAULT/PREFLOP/POSTFLOP) применяется по кнопке «Рассчитать».
 */
export const INTERACTIVE_PREFLOP_ITERATIONS = 600;
export const INTERACTIVE_POSTFLOP_ITERATIONS = 500;
