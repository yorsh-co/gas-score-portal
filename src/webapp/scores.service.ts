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
  /** Regular expression sources removed from the form titles. */
  getTitleStripPatterns(): string[];
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
 * Compiles the title strip patterns, case-insensitively. Invalid patterns are
 * skipped.
 * @param sources Regular expression sources.
 */
function compileTitleStripPatterns(sources: readonly string[]): RegExp[] {
  const compiled: RegExp[] = [];
  sources.forEach((source) => {
    try {
      compiled.push(new RegExp(source, 'gi'));
    } catch {
      // Settings validation rejects these; an old stored value is ignored.
    }
  });
  return compiled;
}

/**
 * Cleans a form title for display.
 * @param title Stored form title.
 * @param strip Patterns whose matches are removed from each title segment.
 */
function normalizeFormTitle(title: string, strip: readonly RegExp[]): string {
  return StringUtils.toProperCase(
    title
      .split(/\s*[-–—]\s*/)
      .map((part) =>
        strip
          .reduce((text, re) => text.replace(re, ''), part.toLowerCase())
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
      const {
        forms,
        respondents,
        scores,
        getExcludedUrls,
        getTitleStripPatterns,
        getLocale,
      } = getDeps();
      const respondent = respondents.findByEmail(userId);
      if (!respondent) return null;

      const byForm = new Map<string, number>();
      const emails = new Set<string>([respondent.email]);
      const alternatives = respondents.findByAlternative(respondent.email);
      const stored = scores.getByEmails([
        respondent.email,
        ...alternatives.map((alt) => alt.email),
      ]);

      // Responses made with an alternative email fill the forms that the
      // respondent has no score for.
      stored
        .filter((s) => s.email === respondent.email)
        .forEach((s) => byForm.set(s.formUrl, s.score));
      stored
        .filter((s) => s.email !== respondent.email)
        .forEach((s) => {
          if (byForm.has(s.formUrl)) return;
          byForm.set(s.formUrl, s.score);
          emails.add(s.email);
        });

      const excluded = new Set(getExcludedUrls());
      const strip = compileTitleStripPatterns(getTitleStripPatterns());
      const entries: UserScoreEntry[] = forms
        .list()
        .filter((f) => f.status !== 'excluded' && !excluded.has(f.url))
        .map((f) => ({
          formTitle: normalizeFormTitle(f.title, strip),
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
