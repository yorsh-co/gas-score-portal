/** One form's score, as served to the web app. */
interface UserScoreEntry {
  formTitle: string;
  /** Maximum points of the form, or `null` when unknown. */
  formPoints: number | null;
  /** `null` when the respondent has not answered the form. */
  score: number | null;
}

/** The scores of one respondent, with the name and emails masked. */
interface UserScores {
  email: string;
  name: string;
  alternatives: string[];
  scores: UserScoreEntry[];
}

/** What the scores service reads, resolved on every call. */
interface ScoresServiceDeps {
  forms: FormsRepo;
  respondents: RespondentsRepo;
  scores: ScoresRepo;
  getExcludedUrls(): string[];
  getLocale(): string;
}

/** Read access to the scores of a respondent. */
interface ScoresService {
  /** Returns the respondent's scores, or `null` when the email is unknown. */
  getByUser(userId: string): UserScores | null;
}

/**
 * Masks a respondent name, keeping the first name and the initial of the last.
 * @param name Full name.
 */
function maskRespondentName(name: string): string {
  const parts = name.trim().split(' ');
  const last = parts[parts.length - 1] ?? '';
  if (parts.length > 2) return `${parts[0]} ... ${last.slice(0, 1)}.`;
  if (parts.length === 2) return `${parts[0]} ${last.slice(0, 1)}.`;
  return name.trim();
}

/**
 * Cleans a form title for display.
 * @param title Stored form title.
 */
function normalizeFormTitle(title: string): string {
  return StringUtils.toProperCase(
    title
      .split(/\s*[-–—]\s*/)
      .map((part) =>
        part
          .toLowerCase()
          .replace('t4', '')
          .replace('checando a aprendizagem', '')
          .trim(),
      )
      .filter(Boolean)
      .join(' - '),
  );
}

/**
 * Creates the scores service.
 * @param getDeps Resolves the repositories and settings; called once per lookup.
 */
function createScoresService(getDeps: () => ScoresServiceDeps): ScoresService {
  return {
    getByUser(userId) {
      const { forms, respondents, scores, getExcludedUrls, getLocale } =
        getDeps();
      const respondent = respondents.findByEmail(userId);
      if (!respondent) return null;

      const byForm = new Map<string, number>();
      const emails = new Set<string>([respondent.email]);
      const stored = scores.getByEmails([respondent.email]);
      stored.forEach((s) => byForm.set(s.formUrl, s.score));

      // Responses made with an alternative email fill the forms that the
      // respondent has no score for.
      respondents.findByAlternative(respondent.email).forEach((alt) => {
        scores.getByEmails([alt.email]).forEach((s) => {
          if (byForm.has(s.formUrl)) return;
          byForm.set(s.formUrl, s.score);
          emails.add(alt.email);
        });
      });

      const excluded = new Set(getExcludedUrls());
      const entries: UserScoreEntry[] = forms
        .list()
        .filter((f) => f.status !== 'excluded' && !excluded.has(f.url))
        .map((f) => ({
          formTitle: normalizeFormTitle(f.title),
          formPoints: f.maxPoints,
          score: byForm.get(f.url) ?? null,
        }));
      const locale = getLocale();
      entries.sort((a, b) =>
        a.formTitle.localeCompare(b.formTitle, locale, {
          sensitivity: 'base',
        }),
      );

      return {
        email: respondent.email,
        name: maskRespondentName(respondent.name),
        alternatives: [...emails].map((email) => StringUtils.maskEmail(email)),
        scores: entries,
      };
    },
  };
}
