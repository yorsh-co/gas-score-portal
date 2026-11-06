/** Supported locales. */
type Locale = 'en' | 'pt-BR';

/** Values interpolated into `{name}` placeholders. */
type MessageParams = Record<string, string | number>;

/** Locale used when the requested one is unknown. */
const DEFAULT_LOCALE: Locale = 'en';

/**
 * Narrows a value to a supported locale, falling back to the default.
 * @param value Candidate locale.
 */
function resolveLocale(value: unknown): Locale {
  return value === 'pt-BR' ? 'pt-BR' : DEFAULT_LOCALE;
}

/**
 * Translates a message. A key missing from the locale falls back to `en`, and
 * a key missing from both is returned as is.
 * @param locale Locale of the message.
 * @param key Message key.
 * @param params Values for the `{name}` placeholders; unknown ones are kept.
 */
function t(
  locale: string | null | undefined,
  key: MessageKey,
  params?: MessageParams,
): string {
  const catalogue: Partial<Messages> =
    resolveLocale(locale) === 'pt-BR' ? MESSAGES_PT_BR : MESSAGES_EN;
  const template = catalogue[key] ?? MESSAGES_EN[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : placeholder,
  );
}
