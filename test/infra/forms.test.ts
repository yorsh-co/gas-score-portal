import { describe, expect, it } from 'vitest';
import { loadApp } from '../harness';

interface FakeResponse {
  respondentEmail?: string;
  typedEmail?: string;
  time: number;
}

/** Builds a fake form whose responses carry a collected or typed email. */
function fakeForm(responses: FakeResponse[], withEmailItem = true) {
  const emailItem = { getTitle: () => 'E-mail' };
  return {
    getId: () => 'form-id',
    getItems: () => (withEmailItem ? [emailItem] : []),
    getResponses: () =>
      responses.map((r) => ({
        getRespondentEmail: () => r.respondentEmail ?? '',
        getResponseForItem: () =>
          r.typedEmail === undefined
            ? null
            : { getResponse: () => r.typedEmail },
        getTimestamp: () => new Date(r.time),
        getGradableItemResponses: () => [{ getScore: () => 1 }],
      })),
  };
}

const emails = (responses: FakeResponse[], withEmailItem = true) => {
  const { app } = loadApp();
  return app.GForms.responses
    .getScores(fakeForm(responses, withEmailItem), {
      multipleResponsesPerUser: 'newest',
    })
    .map((s) => s.email);
};

describe.each([
  [
    'collected email',
    (email: string, time: number) => ({ respondentEmail: email, time }),
  ],
  [
    'typed email item',
    (email: string, time: number) => ({ typedEmail: email, time }),
  ],
])('GForms.responses.getScores with a %s', (_name, build) => {
  it('keeps accented and plain addresses as distinct identities', () => {
    expect(
      emails([build('joão@x.org', 1), build('joao@x.org', 2)]).sort(),
    ).toEqual(['joao@x.org', 'joão@x.org']);
  });

  it('keeps apostrophes in the local part', () => {
    expect(emails([build("o'brien@x.org", 1)])).toEqual(["o'brien@x.org"]);
  });

  it('treats precomposed and decomposed addresses as one identity', () => {
    expect(
      emails([build('jo\u00e3o@x.org', 1), build('joa\u0303o@x.org', 2)]),
    ).toEqual(['jo\u00e3o@x.org']);
  });

  it('treats a lowercased-then-composed address as one identity', () => {
    expect(
      emails([build('\u03aa\u0301@x.org', 1), build('\u0390@x.org', 2)]),
    ).toEqual(['\u0390@x.org']);
  });

  it('normalizes as sign-in does', () => {
    expect(emails([build('  Ana@X.org ', 1)])).toEqual(['ana@x.org']);
  });
});

describe('GForms.responses.getScores without an email', () => {
  const missing = () => loadApp().app.MISSING_RESPONDENT_EMAIL;

  it('uses the missing-email placeholder', () => {
    expect(emails([{ time: 1 }])).toEqual([missing()]);
  });

  it('uses the placeholder when the form has no email item', () => {
    expect(emails([{ time: 1 }], false)).toEqual([missing()]);
  });

  it.each(['', '   '])(
    'treats the typed answer %j as missing',
    (typedEmail) => {
      expect(emails([{ typedEmail, time: 1 }])).toEqual([missing()]);
    },
  );

  it('falls back to the typed answer when the collected email is blank', () => {
    expect(
      emails([{ respondentEmail: '   ', typedEmail: 'Ana@X.org', time: 1 }]),
    ).toEqual(['ana@x.org']);
  });
});
