/** A respondent's score in one form. */
interface FormScore {
  email: string;
  name: string;
  score: number;
}

/** Which response to keep when a respondent answered more than once. */
type MultipleResponsesPolicy = 'newest' | 'oldest';

/** Options of `GForms.responses.getScores`. */
interface FormScoresOptions {
  /** Only responses submitted after this date. */
  after?: Date | undefined;
  multipleResponsesPerUser: MultipleResponsesPolicy;
}

/** Placeholder email of a response that did not provide one. */
const MISSING_RESPONDENT_EMAIL = 'E-mail não fornecido';

/** Google Forms lookups. */
const GForms = (() => {
  const formsLogger = createModuleLogger('forms');

  /**
   * Opens a form by URL or ID.
   * @returns The form, or `null` when it cannot be accessed.
   */
  const getForm = ({
    url,
    id,
  }: {
    url?: string;
    id?: string;
  }): GoogleAppsScript.Forms.Form | null => {
    try {
      if (id) return FormApp.openById(id);
      if (url) return FormApp.openByUrl(url);
    } catch (err) {
      formsLogger.warn('Failed to access form', {
        form: url || id,
        error: String(err),
      });
    }
    return null;
  };

  const getResponses = (
    form: GoogleAppsScript.Forms.Form,
    after?: Date,
  ): GoogleAppsScript.Forms.FormResponse[] => {
    const responses = after ? form.getResponses(after) : form.getResponses();
    formsLogger.info('Got responses', {
      form: form.getId(),
      count: responses.length,
      after: after ? after.toISOString() : null,
    });
    return responses;
  };

  const searchItems = (
    form: GoogleAppsScript.Forms.Form,
    query: string,
  ): GoogleAppsScript.Forms.Item[] => {
    const normalizedQuery = StringUtils.normalize(query);
    return form
      .getItems()
      .filter((item) =>
        StringUtils.normalize(item.getTitle()).includes(normalizedQuery),
      );
  };

  const getResponseForItem = (
    resp: GoogleAppsScript.Forms.FormResponse,
    item: GoogleAppsScript.Forms.Item | undefined,
  ): string => {
    if (!item) return '';
    const itemResponse = resp.getResponseForItem(item);
    return itemResponse ? String(itemResponse.getResponse() || '') : '';
  };

  const getRespondentEmail = (
    resp: GoogleAppsScript.Forms.FormResponse,
    emailItem: GoogleAppsScript.Forms.Item | undefined,
  ): string => {
    const email = resp.getRespondentEmail();
    if (email) return StringUtils.normalizeEmail(email);

    if (emailItem) {
      const itemResp = resp.getResponseForItem(emailItem);
      if (itemResp)
        return StringUtils.normalizeEmail(String(itemResp.getResponse()));
    }

    return MISSING_RESPONDENT_EMAIL;
  };

  /**
   * Computes the score of each respondent of a form, one response per
   * respondent according to `multipleResponsesPerUser`.
   * @param form Quiz form.
   * @param options Date filter and duplicate policy.
   */
  const getRespondentsScores = (
    form: GoogleAppsScript.Forms.Form,
    { after, multipleResponsesPerUser }: FormScoresOptions,
  ): FormScore[] => {
    const emailItem = searchItems(form, 'email')[0];
    const nameItem = searchItems(form, 'nome')[0];

    const kept = new Map<string, GoogleAppsScript.Forms.FormResponse>();
    for (const resp of getResponses(form, after)) {
      const email = getRespondentEmail(resp, emailItem);
      const existing = kept.get(email);
      const isNewer =
        !existing || resp.getTimestamp() > existing.getTimestamp();
      const isOlder =
        !existing || resp.getTimestamp() < existing.getTimestamp();
      if (multipleResponsesPerUser === 'newest' ? isNewer : isOlder)
        kept.set(email, resp);
    }

    const scores = [...kept.entries()].map(([email, resp]) => ({
      email,
      name: StringUtils.toProperCase(getResponseForItem(resp, nameItem)),
      score: resp
        .getGradableItemResponses()
        .reduce((total, itemResp) => total + Number(itemResp.getScore()), 0),
    }));
    formsLogger.info('Got respondent scores', {
      form: form.getId(),
      count: scores.length,
    });
    return scores;
  };

  return {
    forms: {
      hasAccess: (ref: { url?: string; id?: string }): boolean =>
        getForm(ref) !== null,
      get: getForm,
    },
    responses: {
      get: getResponses,
      getScores: getRespondentsScores,
    },
  };
})();
