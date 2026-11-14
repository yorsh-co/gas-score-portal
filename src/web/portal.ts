/** One form's score, as served by `GET /api/me/scores`. */
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
    secondaryColor: string | null;
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
 * Formats a 0-10 value with at most one decimal.
 * @param value Value to format.
 */
function formatOutOfTen(value: number): string {
  return `${Number(value.toFixed(1))} / 10`;
}

/**
 * Score of a form on a 0-10 scale, or the "not answered" label.
 * @param entry Form score.
 */
function scoreLabel(entry: PortalScore): string {
  if (entry.score === null) return tr('portal.notAnswered');
  return formatOutOfTen(scoreOutOfTen(entry.score, entry.formPoints));
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
  const answered = scores.flatMap((s) =>
    s.score === null ? [] : [{ score: s.score, formPoints: s.formPoints }],
  );

  byId('user-name').textContent = data.name;
  byId('user-ids').textContent = data.alternatives.join(', ');
  byId('user-num-responses').textContent = String(answered.length);
  byId('user-average-score').textContent = formatOutOfTen(
    averageOutOfTen(answered),
  );
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
    if (score) score.textContent = scoreLabel(entry);
    tbody.appendChild(row);
  });
  setHidden(['scores-table'], false);

  byId('last-update-timestamp').textContent = tr('portal.updatedAt', {
    date: new Date().toLocaleString(locale),
  });
}

/** Key of the session token in `sessionStorage`. */
const TOKEN_KEY = 'portal.token';

/** Session token, kept in memory too in case storage is unavailable. */
let sessionToken: string | null = null;

let state: PortalState = initialPortalState();
let shownPanel: PortalPanel | null = null;
let resendTimer: number | undefined;

/** IDs of the buttons with a request in flight. */
const busyButtons = new Set<string>();

/**
 * Bumped when the user leaves the current flow (sign out, change email), so
 * that late responses of the abandoned flow are dropped.
 */
let generation = 0;

/**
 * Reads the stored session token.
 * @returns The token, or `null` when none is stored or storage is blocked.
 */
function loadToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Keeps the session token for the tab, or forgets it.
 * @param token Token to keep, or `null` to forget it.
 */
function saveToken(token: string | null): void {
  sessionToken = token;
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage is blocked; the in-memory token still serves this page.
  }
}

/**
 * Status and message of a failed call.
 * @param error Rejection of the API client.
 */
function failureOf(error: unknown): Extract<PortalEvent, { type: 'failed' }> {
  const { status, message } = error as { status?: number; message?: string };
  return {
    type: 'failed',
    status: typeof status === 'number' ? status : null,
    message: message ? (message.endsWith('.') ? message : `${message}.`) : null,
  };
}

/** Text of the resend button for the time left. */
function renderResend(): void {
  if (busyButtons.has('resend-btn')) return;
  const button = byId<HTMLButtonElement>('resend-btn');
  const left = resendSecondsLeft(state, Date.now());
  button.disabled = left > 0;
  button.textContent =
    left > 0
      ? tr('portal.resendIn', { seconds: left })
      : tr('portal.resendButton');
  if (left === 0 && resendTimer !== undefined) {
    window.clearInterval(resendTimer);
    resendTimer = undefined;
  }
}

/** Moves focus to the main control of a panel. */
function focusPanel(panel: PortalPanel): void {
  const target = {
    email: 'email',
    code: 'code',
    results: 'results-panel',
  }[panel];
  byId(target).focus();
}

/** Shows the panel and error of the current state. */
function render(): void {
  const panel = portalPanel(state);
  setHidden(['email-panel'], panel !== 'email');
  setHidden(['code-panel'], panel !== 'code');
  setHidden(['results-panel'], panel !== 'results');

  const text = state.errorText ?? (state.errorKey ? tr(state.errorKey) : '');
  byId('error').textContent = text;

  if (panel === 'code') {
    byId('code-help').textContent = tr('portal.codeHelp', {
      email: state.email,
    });
    renderResend();
    if (resendTimer === undefined && resendSecondsLeft(state, Date.now())) {
      resendTimer = window.setInterval(renderResend, 1000);
    }
  }
  if (panel !== shownPanel) {
    shownPanel = panel;
    focusPanel(panel);
  }
}

/** Applies an event to the flow state and redraws. */
function dispatch(event: PortalEvent): void {
  state = reducePortal(state, event);
  render();
}

/**
 * Runs a call with the button disabled and a spinner on it.
 * @param buttonId Button that triggered the call.
 * @param call Starts the call.
 */
function withBusyButton(buttonId: string, call: () => Promise<void>): void {
  const button = byId<HTMLButtonElement>(buttonId);
  if (busyButtons.has(buttonId) || button.disabled) return;
  busyButtons.add(buttonId);
  button.disabled = true;
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  button.appendChild(spinner);
  call().finally(() => {
    spinner.remove();
    busyButtons.delete(buttonId);
    button.disabled = false;
    if (buttonId === 'resend-btn') renderResend();
  });
}

/**
 * Requests a code for an email.
 * @param email Normalized email.
 */
function requestCode(email: string): Promise<void> {
  const started = generation;
  return window.GasWebApp.api
    .post('/api/auth/otp', { email })
    .then(() => {
      if (started !== generation) return;
      byId<HTMLInputElement>('code').value = '';
      dispatch({ type: 'otpSent', email, now: Date.now() });
    })
    .catch((error: unknown) => {
      window.GasWebApp.errors.logServerError(error as Error, 'Portal');
      if (started === generation) dispatch(failureOf(error));
    });
}

/** Submits the email form. */
function submitEmail(): void {
  if (byId<HTMLButtonElement>('send-btn').disabled) return;
  const email = normalizeEmailInput(byId<HTMLInputElement>('email').value);
  if (!email) {
    dispatch({ type: 'invalidInput', key: 'portal.emailRequired' });
  } else if (!EMAIL_PATTERN.test(email)) {
    dispatch({ type: 'invalidInput', key: 'portal.emailInvalid' });
  } else {
    withBusyButton('send-btn', () => requestCode(email));
  }
}

/** Loads the scores of the signed-in respondent. */
function loadScores(): Promise<void> {
  resetResult();
  const started = generation;
  return window.GasWebApp.api
    .get<PortalUserScores>('/api/me/scores', {
      params: { token: sessionToken ?? '' },
    })
    .then((data) => {
      if (started === generation) renderResult(data);
    })
    .catch((error: unknown) => {
      window.GasWebApp.errors.logServerError(error as Error, 'Portal');
      if (started !== generation) return;
      const failure = failureOf(error);
      if (failure.status === 401) saveToken(null);
      dispatch(failure);
    });
}

/** Submits the code form. */
function submitCode(): void {
  if (byId<HTMLButtonElement>('verify-btn').disabled) return;
  const code = normalizeCodeInput(byId<HTMLInputElement>('code').value);
  if (code.length !== OTP_LENGTH) {
    dispatch({ type: 'invalidInput', key: 'portal.codeInvalid' });
    return;
  }
  const started = generation;
  withBusyButton('verify-btn', () =>
    window.GasWebApp.api
      .post<{ token: string }>('/api/auth/verify', {
        email: state.email,
        code,
      })
      .then(({ token }) => {
        if (started !== generation) return;
        saveToken(token);
        byId<HTMLInputElement>('code').value = '';
        dispatch({ type: 'verified' });
        return loadScores();
      })
      .catch((error: unknown) => {
        window.GasWebApp.errors.logServerError(error as Error, 'Portal');
        if (started === generation) dispatch(failureOf(error));
      }),
  );
}

/** Returns to the email form, dropping responses still in flight. */
function changeEmail(): void {
  generation++;
  dispatch({ type: 'changeEmail' });
}

/**
 * Forgets the session and returns to the email form. Client-side only: the
 * token is not revoked on the server.
 */
function signOut(): void {
  generation++;
  saveToken(null);
  resetResult();
  byId<HTMLInputElement>('email').value = '';
  dispatch({ type: 'signOut' });
}

/** Resumes the session stored for this tab, if any. */
function restoreSession(): void {
  const token = loadToken();
  if (!token) return;
  saveToken(token);
  dispatch({ type: 'restore' });
  loadScores();
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
 * Applies the owner's brand settings over the built-in identity. The primary
 * colour overrides `--accent` and its derived `--accent-strong`; the secondary
 * colour overrides `--brand` (links, focus ring, borders).
 * @param brand Brand settings from the server.
 */
function applyBrand(brand: PortalMeta['brand']): void {
  if (brand.primaryColor) {
    const { style } = document.documentElement;
    style.setProperty('--accent', brand.primaryColor);
    style.setProperty(
      '--accent-strong',
      `color-mix(in srgb, ${brand.primaryColor} 85%, black)`,
    );
  }
  if (brand.secondaryColor) {
    document.documentElement.style.setProperty('--brand', brand.secondaryColor);
  }
  if (brand.logoUrl) {
    document.getElementById('portal-logo-dark')?.remove();
    byId<HTMLImageElement>('portal-logo').src = brand.logoUrl;
  }
}

/** Loads the locale and title from the server before the page is used. */
function loadMeta(): void {
  const button = byId<HTMLButtonElement>('send-btn');
  button.disabled = true;
  window.GasWebApp.api
    .get<PortalMeta>('/api/meta')
    .then((meta) => {
      locale = resolveLocale(meta.locale);
      byId('portal-title').textContent = meta.portalTitle;
      applyBrand(meta.brand);
      applyTranslations();
      render();
    })
    .catch((error: unknown) =>
      window.GasWebApp.errors.logServerError(error as Error, 'Portal'),
    )
    .finally(() => {
      button.disabled = false;
    });
}

// The server logs its own errors; the reporter forwards only client-side failures.
window.GasWebApp.reporter?.install({
  route: '/api/client-errors',
  captureGlobal: true,
});
loadMeta();
restoreSession();
byId('email-panel').addEventListener('submit', (event) => {
  event.preventDefault();
  submitEmail();
});
byId('code-panel').addEventListener('submit', (event) => {
  event.preventDefault();
  submitCode();
});
byId('code').addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  input.value = normalizeCodeInput(input.value);
});
byId('email').addEventListener('input', () =>
  dispatch({ type: 'dismissError' }),
);
byId('code').addEventListener('input', () =>
  dispatch({ type: 'dismissError' }),
);
byId('resend-btn').addEventListener('click', () => {
  withBusyButton('resend-btn', () => requestCode(state.email));
});
byId('change-email-btn').addEventListener('click', changeEmail);
byId('sign-out-btn').addEventListener('click', signOut);
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (target.classList.contains('cell-ellipsis')) {
    target.classList.toggle('expanded');
  }
});
