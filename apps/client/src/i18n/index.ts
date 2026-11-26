import { en, type TranslationSchema } from './locales/en';
import { km } from './locales/km';
import type { SidebarLanguage } from '@/types/sidebar';

export type SupportedLanguage = SidebarLanguage;

export const translations: Record<SupportedLanguage, TranslationSchema> = {
  en,
  km,
};

/**
 * Returns the dictionary for the specified language.
 */
export function getTranslation(
  lang: SupportedLanguage = 'en',
): TranslationSchema {
  return translations[lang] ?? translations.en;
}

/**
 * Returns a translated string via a type-safe selector function, filling the
 * template's named `{placeholder}`s from `params`. A placeholder without a
 * param renders the visible sentinel `{name?}` — compliance copy fails
 * loudly in tests instead of crashing the UI at runtime. Templates stay
 * plain strings so the dictionary's shape type keeps forcing key parity
 * across languages.
 * Example: t('en', (d) => d.common.save) -> "Save"
 * Example: t('en', (d) => d.traceGraph.disclosure.nodesVsCap, { returned: 4, cap: 500 }) -> "4 of 500 cap"
 */
export function t(
  lang: SupportedLanguage,
  selector: (dict: TranslationSchema) => string,
  params?: Record<string, string | number>,
): string {
  const template = selector(getTranslation(lang));
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name) => {
    const value = params?.[name];
    return value === undefined ? `{${name}?}` : String(value);
  });
}

export { en, km, type TranslationSchema };
