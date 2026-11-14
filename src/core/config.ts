/** Separator of list-valued settings stored as multi-line text. */
const CONFIG_LIST_SEPARATOR = '\n';

/**
 * Settings schema, stored in Script Properties and edited in the gas-config
 * dialog. Secrets must not be added here.
 */
const CONFIG_SCHEMA = {
  locale: {
    type: 'select',
    label: 'Language',
    description: 'Language of the menu, messages and web app.',
    group: 'general',
    default: 'en',
    required: true,
    options: [
      { value: 'en', label: 'English' },
      { value: 'pt-BR', label: 'Portugu\u00eas (Brasil)' },
    ],
  },
  portalTitle: {
    type: 'string',
    label: 'Portal title',
    description: 'Title of the web app page.',
    group: 'general',
    default: 'Score Portal',
    maxLength: 100,
  },
  primaryColor: {
    type: 'string',
    label: 'Primary color',
    description:
      'Colour of the main action button, as a hex code such as #a34a1c. Empty uses Yorsh copper. Check it has 4.5:1 contrast with white text.',
    group: 'general',
    pattern: '^#[0-9a-fA-F]{6}$',
    patternMessage: 'Use a hex color such as #a34a1c.',
  },
  secondaryColor: {
    type: 'string',
    label: 'Secondary color',
    description:
      'Colour of links and focus rings, as a hex code such as #0f5563. Empty uses Yorsh petrol.',
    group: 'general',
    pattern: '^#[0-9a-fA-F]{6}$',
    patternMessage: 'Use a hex color such as #0f5563.',
  },
  logoUrl: {
    type: 'url',
    label: 'Logo URL',
    description:
      'HTTPS address of the web app logo. Empty uses the built-in one.',
    group: 'general',
    pattern: '^https://',
    patternMessage: 'Use an address that starts with https://.',
  },
  faviconUrl: {
    type: 'url',
    label: 'Favicon URL',
    description:
      'HTTPS address of the web app icon. Empty uses the Yorsh icon.',
    group: 'general',
    default: 'https://yorsh.co/assets/icon/favicon-32x32.png',
    pattern: '^https://',
    patternMessage: 'Use an address that starts with https://.',
  },
  privacyPolicyUrl: {
    type: 'url',
    label: 'Privacy policy URL',
    description: 'Linked in the web app footer.',
    group: 'general',
    default: 'https://yorsh.co/privacy',
    pattern: '^https://',
    patternMessage: 'Use an address that starts with https://.',
  },
  termsUrl: {
    type: 'url',
    label: 'Terms URL',
    description: 'Linked in the web app footer.',
    group: 'general',
    default: 'https://yorsh.co/terms',
    pattern: '^https://',
    patternMessage: 'Use an address that starts with https://.',
  },
  driveFolderUrl: {
    type: 'url',
    label: 'Drive folder URL',
    description: 'Folder that is searched for Google Forms to import.',
    group: 'forms',
  },
  formsTitleQuery: {
    type: 'string',
    label: 'Forms title filter',
    description: 'Only Forms whose title contains this text are imported.',
    group: 'forms',
  },
  formsFullTextQuery: {
    type: 'string',
    label: 'Forms content filter',
    description: 'Only Forms whose content contains this text are imported.',
    group: 'forms',
  },
  excludedFormUrls: {
    type: 'text',
    label: 'Excluded Forms',
    description: 'Edit URLs of Forms to ignore, one per line.',
    group: 'forms',
  },
  formTitleStripPatterns: {
    type: 'text',
    label: 'Form title clean-up',
    description:
      'Regular expressions (case-insensitive), one per line. Matches are removed from the Form titles shown in the web app.',
    group: 'forms',
    validate: (value) => findInvalidPattern(value),
  },
} satisfies GasConfigSchema;

/**
 * Returns an error message naming the first line of a multi-line setting that
 * is not a valid regular expression, or null when all are valid.
 * @param value Setting value, one pattern per line.
 */
function findInvalidPattern(value: string): string | null {
  for (const line of value.split(CONFIG_LIST_SEPARATOR)) {
    const pattern = line.trim();
    if (pattern === '') continue;
    try {
      new RegExp(pattern, 'i');
    } catch {
      return `Invalid regular expression: ${pattern}`;
    }
  }
  return null;
}

/** The typed settings object. */
type AppConfig = GasConfig<typeof CONFIG_SCHEMA>;

let memoizedConfig: AppConfig | undefined;

/**
 * Returns the emails allowed to change the settings: the owner and editors of
 * the container spreadsheet. Fails closed, returning none, if they cannot be
 * read.
 */
function resolveConfigEditors(): string[] {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const owner = spreadsheet.getOwner();
    const emails = spreadsheet.getEditors().map((user) => user.getEmail());
    if (owner) emails.push(owner.getEmail());
    return emails.filter((email) => email !== '');
  } catch (err) {
    createModuleLogger('config').warn('Could not resolve the editors', {
      error: String(err),
    });
    return [];
  }
}

/**
 * Returns the settings. Created once per execution.
 */
function getConfig(): AppConfig {
  if (!memoizedConfig) {
    memoizedConfig = new GasConfig({
      schema: CONFIG_SCHEMA,
      groups: [
        { id: 'general', label: 'General' },
        { id: 'forms', label: 'Google Forms' },
      ],
      title: 'Settings',
      appName: 'Score Portal',
      editors: resolveConfigEditors(),
      logger: createModuleLogger('config'),
    });
  }
  return memoizedConfig;
}

/**
 * Returns the locale of the menu, messages and web app. Falls back to the
 * default when the settings cannot be read.
 */
function getLocale(): Locale {
  try {
    return resolveLocale(getConfig().get('locale'));
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Translates a message into the configured locale.
 * @param key Message key.
 * @param params Values for the `{name}` placeholders.
 */
function tr(key: MessageKey, params?: MessageParams): string {
  return t(getLocale(), key, params);
}

/**
 * Returns the URLs of the Forms excluded from synchronization.
 */
function getExcludedFormUrls(): string[] {
  const raw = getConfig().get('excludedFormUrls') ?? '';
  return raw
    .split(CONFIG_LIST_SEPARATOR)
    .map((url) => url.trim())
    .filter((url) => url !== '');
}

/**
 * Returns the regular expression sources removed from the Form titles.
 */
function getFormTitleStripPatterns(): string[] {
  const raw = getConfig().get('formTitleStripPatterns') ?? '';
  return raw
    .split(CONFIG_LIST_SEPARATOR)
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern !== '');
}

/**
 * Stores setting values. Requires the active user to be an editor of the
 * settings.
 * @param changes Values by setting key.
 */
function saveConfigValues(changes: Record<string, string>): void {
  const config = getConfig();
  const outcome = config._saveChanges({
    changes,
    version: config._readSnapshot().version,
    saveId: Utilities.getUuid(),
  });
  if (outcome.ok) return;
  if (outcome.reason === 'invalid') {
    throw new GasValidationError(Object.values(outcome.errors).join(' '));
  }
  throw new GasConflictError(tr('error.settingsConflict'));
}

/**
 * Stores the URLs of the Forms excluded from synchronization.
 * Requires the active user to be an editor of the settings.
 * @param urls Edit URLs, without duplicates.
 */
function saveExcludedFormUrls(urls: readonly string[]): void {
  saveConfigValues({ excludedFormUrls: urls.join(CONFIG_LIST_SEPARATOR) });
}

/**
 * Stores the Drive folder that is searched for Forms.
 * Requires the active user to be an editor of the settings.
 * @param url Folder URL.
 */
function saveDriveFolderUrl(url: string): void {
  saveConfigValues({ driveFolderUrl: url });
}

// GasConfigRpc, called by the settings dialog, starts from a blank global
// scope and routes to the latest constructed instance, so one must exist.
getConfig();
