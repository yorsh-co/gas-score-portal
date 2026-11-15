/** Message that `LockService.waitLock` documents for a wait timeout. */
const DOCUMENTED_LOCK_TIMEOUT_MESSAGE =
  'Exception: Lock timeout: another process was holding the lock for too long.';

test('repositories join the script lock held by the caller', (ctx) => {
  const { forms } = createTestRepos(createTestTables(ctx));

  GasLock.withLock('script', () => {
    forms.upsert({ url: 'u1', title: 'Alpha' });
    assert(GasLock.isHeld('script'), 'a nested write must keep the lock held');
  });

  assert(!GasLock.isHeld('script'), 'the lock must be released afterwards');
  const probe = LockService.getScriptLock();
  assert(probe.tryLock(0), 'a fresh handle must acquire the released lock');
  probe.releaseLock();
});

test('the lock is released when the guarded callback throws', () => {
  let message = '';
  try {
    GasLock.withLock('script', () => {
      throw new Error('boom');
    });
  } catch (err) {
    message = getErrorMessage_(err);
  }

  assert(message === 'boom', 'the callback error must propagate');
  assert(!GasLock.isHeld('script'), 'the lock must be released');
});

test('isLockTimeoutError_ matches the documented LockService message', () => {
  assert(
    isLockTimeoutError_(new Error(DOCUMENTED_LOCK_TIMEOUT_MESSAGE)),
    'the documented message must be recognised',
  );
  assert(!isLockTimeoutError_(new Error('Range not found')), 'unrelated');
});

info('lock timeout', () => {
  // GasLock re-enters the lock its own execution holds, so a real timeout
  // needs a second concurrent execution and cannot be produced here.
  return 'timeout message not captured from a live contention';
});
