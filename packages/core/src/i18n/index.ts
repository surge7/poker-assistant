/**
 * i18n-точка входа ядра: словарь сообщений совета + хелпер подстановки параметров.
 *
 * Тексты живут в ru.ts (русский, по умолчанию) и en.ts (английский).
 * Переключение локали в runtime — через setLocale().
 *
 * Чтобы изменить формулировку, правьте ru.ts / en.ts — advice.ts трогать не нужно.
 */

import type { AdviceMessages } from './messages';
import { ruAdviceMessages } from './ru';
import { enAdviceMessages } from './en';

export type { AdviceMessages, AdviceReasonMessages, AdviceDetailsMessages } from './messages';

/** Поддерживаемые локали. */
export type Locale = 'ru' | 'en';

const LOCALES: Record<Locale, AdviceMessages> = {
  ru: ruAdviceMessages,
  en: enAdviceMessages,
};

let currentLocale: Locale = 'ru';

/**
 * Текущий словарь сообщений совета.
 * Геттер, а не константа, чтобы setLocale() менял локаль в runtime
 * без изменений в advice.ts.
 */
export function messages(): AdviceMessages {
  return LOCALES[currentLocale];
}

/** Активная локаль. */
export function getLocale(): Locale {
  return currentLocale;
}

/** Переключить локаль. Возвращает true, если локаль поддерживается. */
export function setLocale(locale: Locale): boolean {
  if (!(locale in LOCALES)) return false;
  currentLocale = locale;
  return true;
}

/**
 * Подставить параметры в шаблон вида "Текст {name}.".
 * Неизвестный плейсхолдер остаётся как есть ({name}) — чтобы ошибку было видно.
 *
 * @example fmt('Сильное дро — {outs} аутов.', { outs: 8 }) → 'Сильное дро — 8 аутов.'
 */
export function fmt(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}
