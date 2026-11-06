test('scores service serves a respondent end to end', (ctx) => {
  const repos = createTestRepos(createTestTables(ctx));
  repos.forms.upsert({ url: 'u1', title: 'Alpha', maxPoints: 10 });
  repos.forms.upsert({ url: 'u2', title: 'Beta', maxPoints: 20 });
  repos.forms.upsert({ url: 'u3', title: 'Hidden', status: 'excluded' });
  repos.respondents.upsert({
    email: 'ana@x.org',
    name: 'Ana Maria Souza',
    alternatives: '',
  });
  repos.respondents.upsert({
    email: 'ana@old.org',
    name: 'Ana',
    alternatives: 'ana@x.org',
  });
  repos.scores.upsertMany('u1', [{ email: 'ana@x.org', score: 0 }]);
  repos.scores.upsertMany('u2', [{ email: 'ana@old.org', score: 15 }]);

  const service = createScoresService(() => ({
    ...repos,
    getExcludedUrls: () => [],
    getLocale: () => 'en',
  }));
  const result = service.getByUser('ANA@x.org');

  assert(result !== null, 'the respondent must be found');
  assert(result?.name === 'Ana ... S.', `name: ${result?.name}`);
  assert(result?.scores.length === 2, 'excluded forms are hidden');
  assert(result?.scores[0]?.score === 0, 'a zero score is served as 0');
  assert(result?.scores[1]?.score === 15, 'alternative email fills the gap');
  assert(service.getByUser('nobody@x.org') === null, 'unknown email');
});
