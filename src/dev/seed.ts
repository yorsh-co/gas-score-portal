/** Email domain reserved for demo respondents (RFC 2606). */
const DEMO_EMAIL_DOMAIN = 'example.com';

/** URL prefix shared by all demo forms. */
const DEMO_FORM_URL_PREFIX = 'https://example.com/demo-forms/';

const DEMO_FORM_TITLES = [
  'Module 1 – Foundations',
  'Module 2 – Core Concepts',
  'Module 3 – Data Handling',
  'Module 4 – Automation',
  'Module 5 – Integrations',
  'Module 6 – Security',
  'Module 7 – Performance',
  'Module 8 – Capstone',
];

const DEMO_MAX_POINTS = [10, 20, 50, 100];

const DEMO_FIRST_NAMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elena',
  'Felipe',
  'Giulia',
  'Hugo',
  'Isabela',
  'Joao',
];

const DEMO_LAST_NAMES = [
  'Almeida',
  'Barros',
  'Cardoso',
  'Duarte',
  'Esteves',
  'Ferreira',
  'Gomes',
  'Honorato',
];

/** Generated demo rows for the `Forms`, `Respondents` and `Scores` tables. */
interface DemoData {
  forms: FormRecord[];
  respondents: RespondentRecord[];
  scores: (ScoreInput & { formUrl: string })[];
}

/** Size and seed of the generated demo data. */
interface DemoDataOptions {
  /** Number of respondents. Defaults to 40. */
  respondents?: number;
  /** Number of forms. Defaults to 8. */
  forms?: number;
  /** PRNG seed. Defaults to 1. */
  seed?: number;
}

/**
 * Creates a deterministic pseudo-random generator (mulberry32).
 * @param seed Initial state.
 * @returns A function returning numbers in `[0, 1)`.
 */
function createDemoRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks the item at a position, wrapping around the list.
 * @param list Non-empty list.
 * @param index Position, possibly beyond the end.
 */
function pickAt<T>(list: readonly T[], index: number): T {
  return list[index % list.length] as T;
}

/**
 * Builds deterministic fake data. Pure: the same options give the same result.
 * @param options Sizes and seed.
 */
function buildDemoData(options: DemoDataOptions = {}): DemoData {
  const respondentCount = options.respondents ?? 40;
  const formCount = options.forms ?? 8;
  const random = createDemoRandom(options.seed ?? 1);
  const pad = (n: number) => String(n).padStart(2, '0');

  const forms: FormRecord[] = [];
  for (let i = 0; i < formCount; i++) {
    const base = pickAt(DEMO_FORM_TITLES, i);
    forms.push({
      url: `${DEMO_FORM_URL_PREFIX}form-${pad(i + 1)}`,
      title:
        i < DEMO_FORM_TITLES.length
          ? base
          : `${base} (${Math.floor(i / DEMO_FORM_TITLES.length) + 1})`,
      maxPoints: pickAt(DEMO_MAX_POINTS, i),
      status: 'linked',
      syncedAt: null,
      error: '',
    });
  }

  const respondents: RespondentRecord[] = [];
  const scores: DemoData['scores'] = [];
  for (let i = 0; i < respondentCount; i++) {
    const first = pickAt(
      DEMO_FIRST_NAMES,
      Math.floor(random() * DEMO_FIRST_NAMES.length),
    );
    const last = pickAt(
      DEMO_LAST_NAMES,
      Math.floor(random() * DEMO_LAST_NAMES.length),
    );
    const local = `${first}.${last}${i + 1}`.toLowerCase();
    const email = `${local}@${DEMO_EMAIL_DOMAIN}`;
    const alternative = i % 5 === 0 ? `${local}.alt@${DEMO_EMAIL_DOMAIN}` : '';
    respondents.push({
      email,
      name: `${first} ${last}`,
      alternatives: alternative,
    });

    const answered = forms.filter(() => random() < 0.7);
    if (answered.length === 0 && forms.length > 0) {
      answered.push(pickAt(forms, Math.floor(random() * forms.length)));
    }
    for (const form of answered) {
      const max = form.maxPoints ?? 0;
      scores.push({
        email: alternative && random() < 0.5 ? alternative : email,
        formUrl: form.url,
        score: Math.min(max, Math.round(max * (0.4 + 0.6 * random()))),
      });
    }
  }

  return { forms, respondents, scores };
}

/**
 * Whether the email belongs to the demo data.
 * @param email Address to check.
 */
function isDemoEmail(email: string): boolean {
  return String(email).trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

/**
 * Whether the form URL belongs to the demo data.
 * @param url Form URL to check.
 */
function isDemoFormUrl(url: string): boolean {
  return String(url).startsWith(DEMO_FORM_URL_PREFIX);
}
