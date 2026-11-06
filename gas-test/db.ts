test('forms repo upserts and updates status on a real sheet', (ctx) => {
  const { forms } = createTestRepos(createTestTables(ctx));

  forms.upsert({ url: 'u1', title: 'Alpha', maxPoints: 10 });
  forms.upsert({ url: 'u1', title: 'Alpha 2' });
  forms.updateStatus('u1', 'error', 'no access');

  const stored = forms.get('u1');
  assert(forms.list().length === 1, 'upsert must not duplicate the form');
  assert(stored?.title === 'Alpha 2', 'title must be updated');
  assert(stored?.maxPoints === 10, 'maxPoints must survive a partial upsert');
  assert(stored?.status === 'error', 'status must be updated');
  assert(stored?.error === 'no access', 'error text must be stored');
});

test('respondents repo normalizes emails and finds alternatives', (ctx) => {
  const { respondents } = createTestRepos(createTestTables(ctx));

  const added = respondents.insertMissing([
    { email: ' Ana@X.org ', name: 'Ana', alternatives: 'ana@old.org' },
    { email: 'ana@x.org', name: 'Dup', alternatives: '' },
    { email: 'bob@x.org', name: 'Bob', alternatives: '' },
  ]);

  assert(added === 2, `expected 2 inserted, got ${added}`);
  assert(respondents.findByEmail('ANA@x.org')?.name === 'Ana', 'lookup');
  assert(
    respondents.findByAlternative('ana@old.org').length === 1,
    'alternative lookup',
  );
});

test('scores repo upsertMany reports inserted, updated and unchanged', (ctx) => {
  const { scores } = createTestRepos(createTestTables(ctx));

  const first = scores.upsertMany('u1', [
    { email: 'a@x.org', score: 5 },
    { email: 'b@x.org', score: 0 },
  ]);
  const second = scores.upsertMany('u1', [
    { email: 'a@x.org', score: 7 },
    { email: 'b@x.org', score: 0 },
    { email: 'c@x.org', score: 1 },
  ]);

  assert(first.inserted === 2, 'first run inserts both');
  assert(
    second.updated === 1 && second.unchanged === 1 && second.inserted === 1,
    `unexpected second result ${JSON.stringify(second)}`,
  );
  const byForm = scores.getByForm('u1');
  assert(byForm.get('a@x.org') === 7, 'changed score is stored');
  assert(byForm.get('b@x.org') === 0, 'a zero score is preserved');
});
