import { describe, it, expect } from 'vitest';
import { messages, getLocale, setLocale, fmt } from './index';
import { ruAdviceMessages } from './ru';
import { enAdviceMessages } from './en';

describe('i18n', () => {
  it('по умолчанию активна русская локаль', () => {
    expect(getLocale()).toBe('ru');
    expect(messages()).toBe(ruAdviceMessages);
  });

  it('setLocale переключает словарь', () => {
    expect(setLocale('en')).toBe(true);
    expect(getLocale()).toBe('en');
    expect(messages()).toBe(enAdviceMessages);
    expect(messages().reason.nuts).toBe('Nuts — maximize the pot.');
    // возвращаем обратно, чтобы не влиять на другие тесты
    setLocale('ru');
  });

  it('setLocale с неизвестной локалью возвращает false и не меняет состояние', () => {
    const before = getLocale();
    // @ts-expect-error — намеренно неизвестная локаль
    expect(setLocale('de')).toBe(false);
    expect(getLocale()).toBe(before);
  });

  it('все ключи reason присутствуют в обеих локалях', () => {
    const ruKeys = Object.keys(ruAdviceMessages.reason);
    const enKeys = Object.keys(enAdviceMessages.reason);
    expect(enKeys.sort()).toEqual(ruKeys.sort());
  });

  it('все ключи details присутствуют в обеих локалях', () => {
    const ruKeys = Object.keys(ruAdviceMessages.details);
    const enKeys = Object.keys(enAdviceMessages.details);
    expect(enKeys.sort()).toEqual(ruKeys.sort());
  });

  it('плейсхолдеры в шаблонах ru совпадают с en (одинаковая сигнатура)', () => {
    const extract = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const allRu = [
      ...Object.values(ruAdviceMessages.reason),
      ...Object.values(ruAdviceMessages.details),
    ];
    const allEn = [
      ...Object.values(enAdviceMessages.reason),
      ...Object.values(enAdviceMessages.details),
    ];
    // Кол-во шаблонов совпадает (значит, и пар плейсхолдеров можно сравнивать)
    expect(allEn).toHaveLength(allRu.length);
    for (let i = 0; i < allRu.length; i++) {
      expect(extract(allEn[i])).toEqual(extract(allRu[i]));
    }
  });

  describe('fmt', () => {
    it('подставляет числовые и строковые параметры', () => {
      expect(fmt('Сильное дро — {outs} аутов.', { outs: 8 })).toBe('Сильное дро — 8 аутов.');
      expect(fmt('{a} + {b}', { a: 'x', b: 2 })).toBe('x + 2');
    });

    it('без параметров возвращает шаблон как есть', () => {
      expect(fmt('Без плейсхолдеров')).toBe('Без плейсхолдеров');
      expect(fmt('Текст {x}')).toBe('Текст {x}');
    });

    it('неизвестный плейсхолдер остаётся в строке (видимая ошибка)', () => {
      expect(fmt('Шаблон {missing}', { other: 1 })).toBe('Шаблон {missing}');
    });
  });
});
