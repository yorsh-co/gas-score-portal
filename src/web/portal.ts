/** One form's score, as served by `GET /api/users/:userId/scores`. */
interface PortalScore {
  formTitle: string;
  formPoints: number | null;
  score: number | null;
}

/** The response of the scores route. */
interface PortalUserScores {
  email: string;
  name: string;
  alternatives: string[];
  scores: PortalScore[];
}

/** The response of `GET /api/meta`. */
interface PortalMeta {
  locale: Locale;
  portalTitle: string;
  brand: {
    primaryColor: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let locale: Locale = DEFAULT_LOCALE;

/**
 * Translates a message into the portal locale.
 * @param key Message key.
 * @param params Values for the `{name}` placeholders.
 */
function tr(key: MessageKey, params?: MessageParams): string {
  return t(locale, key, params);
}

/**
 * Looks up an element that the page is known to contain.
 * @param id Element ID.
 */
function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

/**
 * Lowercases an email and strips accents and characters that cannot be part
 * of an address.
 * @param value Raw input.
 */
function normalizeEmailInput(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}@._+-]/gu, '');
}

/**
 * Average score on a 0-10 scale, with one decimal when not an integer.
 * @param scores Scores to average.
 */
function averageScore(scores: PortalScore[]): string {
  const total = scores.reduce((sum, s) => sum + (s.score ?? 0), 0);
  const average = scores.length ? total / scores.length : 0;
  return Number.isInteger(average) ? String(average) : average.toFixed(1);
}

/**
 * Score of a form on a 0-10 scale.
 * @param entry Form score.
 */
function scoreOutOfTen(entry: PortalScore): string {
  if (entry.score === null) return tr('portal.notAnswered');
  const scaled =
    entry.formPoints && entry.formPoints !== 10
      ? (entry.score / entry.formPoints) * 10
      : entry.score;
  return `${Number(scaled.toFixed(1))} / 10`;
}

/** Shows or hides the elements, by ID. */
function setHidden(ids: string[], hidden: boolean): void {
  ids.forEach((id) => (byId(id).hidden = hidden));
}

/** Clears the previous result. */
function resetResult(): void {
  [
    'user-name',
    'user-ids',
    'user-num-responses',
    'user-average-score',
    'last-update-timestamp',
    'scores-tbody',
  ].forEach((id) => (byId(id).textContent = ''));
  setHidden(['summary-table', 'scores-table', 'empty-state'], true);
}

/**
 * Renders the summary and the scores table.
 * @param data Scores of the respondent.
 */
function renderResult(data: PortalUserScores): void {
  const scores = data.scores;
  const answered = scores.filter((s) => s.score !== null);

  byId('user-name').textContent = data.name;
  byId('user-ids').textContent = data.alternatives.join(', ');
  byId('user-num-responses').textContent = String(answered.length);
  byId('user-average-score').textContent = `${averageScore(answered)} / 10`;
  setHidden(['summary-table'], false);

  if (scores.length === 0) {
    setHidden(['empty-state'], false);
    return;
  }

  const template = byId<HTMLTemplateElement>('row-template');
  const tbody = byId('scores-tbody');
  scores.forEach((entry) => {
    const row = template.content.cloneNode(true) as DocumentFragment;
    const name = row.querySelector('.form-name');
    const score = row.querySelector('.form-score');
    if (name) name.textContent = entry.formTitle;
    if (score) score.textContent = scoreOutOfTen(entry);
    tbody.appendChild(row);
  });
  setHidden(['scores-table'], false);

  byId('last-update-timestamp').textContent = tr('portal.updatedAt', {
    date: new Date().toLocaleString(locale),
  });
}

/**
 * Message to show for a failed call.
 * @param error Rejection of the API client.
 */
function errorMessage(error: unknown): string {
  const status = (error as { status?: number }).status;
  const message = (error as { message?: string }).message;
  if (status && status < 500 && message) {
    return message.endsWith('.') ? message : `${message}.`;
  }
  return tr('portal.serverError');
}

/** Loads the scores of the email in the input. */
function loadScores(): void {
  const button = byId<HTMLButtonElement>('load-btn');
  if (button.disabled) return;

  const errorBox = byId('error');
  resetResult();
  errorBox.textContent = '';

  const email = normalizeEmailInput(byId<HTMLInputElement>('email').value);
  if (!email) {
    errorBox.textContent = tr('portal.emailRequired');
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    errorBox.textContent = tr('portal.emailInvalid');
    return;
  }

  button.disabled = true;
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  button.appendChild(spinner);

  window.GasWebApp.api
    .get<PortalUserScores>(`/api/users/${encodeURIComponent(email)}/scores`)
    .then(renderResult)
    .catch((error: unknown) => {
      errorBox.textContent = errorMessage(error);
      console.error(error);
    })
    .finally(() => {
      spinner.remove();
      button.disabled = false;
    });
}

/** Translates the elements that carry a `data-i18n*` attribute. */
function applyTranslations(): void {
  document.documentElement.lang = locale;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    element.textContent = tr(element.dataset.i18n as MessageKey);
  });
  document
    .querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')
    .forEach((element) => {
      element.placeholder = tr(element.dataset.i18nPlaceholder as MessageKey);
    });
}

/**
 * Applies the owner's brand settings over the built-in identity.
 * @param brand Brand settings from the server.
 */
function applyBrand(brand: PortalMeta['brand']): void {
  if (brand.primaryColor) {
    document.documentElement.style.setProperty('--primary', brand.primaryColor);
  }
  if (brand.logoUrl) byId<HTMLImageElement>('portal-logo').src = brand.logoUrl;
}

/** Loads the locale and title from the server before the page is used. */
function loadMeta(): void {
  window.GasWebApp.api
    .get<PortalMeta>('/api/meta')
    .then((meta) => {
      locale = resolveLocale(meta.locale);
      byId('portal-title').textContent = meta.portalTitle;
      applyBrand(meta.brand);
      applyTranslations();
    })
    .catch((error: unknown) => console.error(error));
}

loadMeta();
byId('load-btn').addEventListener('click', loadScores);
byId('email').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadScores();
  }
});
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (target.classList.contains('cell-ellipsis')) {
    target.classList.toggle('expanded');
  }
});
