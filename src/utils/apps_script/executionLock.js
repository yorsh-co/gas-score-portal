/**
 * @typedef {Object} ExecutionLock
 * @property {() => boolean} isLocked
 * @property {() => void} storeLockTimestamp
 * @property {(throwError?: boolean) => boolean} tryToLock
 * @property {(ms: number) => void} setExpiryLimit
 * @property {() => number} getExpiryLimit
 * @property {() => void} release
 * @property {() => void} reset
 */

/**
 * @module ExecutionLock
 * Utility for replacing LockService by using timestamp stored in the script properties.
 * Useful for when LockService doesn't perform as expected.
 * ⚠️ Not atomic — does NOT fully replace LockService.
 * }
 */
const ExecutionLock = () => {
  const key = `lock:execution:${Session.getEffectiveUser().getEmail()}`;
  let expiryLimit = 10 * 60 * 1000;

  /**
   *
   * @returns {Boolean}
   */
  const isLocked = () => {
    let latestTimestamp = ScriptProps.get(key);

    if (!latestTimestamp) return false;

    latestTimestamp = parseInt(latestTimestamp);
    if (isNaN(latestTimestamp)) return false;

    return Date.now() - latestTimestamp < expiryLimit;
  };

  const storeLockTimestamp = () => {
    ScriptProps.add(key, Date.now());
    Logger.log('Updated lock timestamp in script properties');
  };

  /**
   *
   * @param {Boolean} throwError
   * @returns {Boolean}
   */
  const tryToLock = (throwError) => {
    if (isLocked()) {
      if (throwError)
        throw new Error(
          'Script is busy. The last execution is still running or finalizing.',
        );
      else return false;
    }

    storeLockTimestamp();
    return true;
  };

  /**
   *
   * @param {number} limit
   * @param {object} params
   * @param {boolean = false} params.throwError
   */
  const waitForLock = (limit = 60 * 1000, { throwError = false } = {}) => {
    let start = Date.now();
    let gotLock;
    while (Date.now() - start < limit) {
      gotLock = tryToLock(throwError);
      if (gotLock) return true;
      Utilities.sleep(Math.ceil(Math.random() * (10 * 1000)));
    }
    return false;
  };

  const setExpiryLimit = (ms) => (expiryLimit = ms);

  const getExpiryLimit = () => expiryLimit;

  const release = () => ScriptProps.del(key);

  const releaseAll = () =>
    Object.keys(ScriptProps.getAll())
      .filter((key) => key.includes('lock:execution'))
      .forEach((key) => ScriptProps.del(key));

  const reset = () => {
    ScriptProps.del(key);
    expiryLimit = 10 * 60 * 1000;
  };

  return {
    isLocked,
    storeLockTimestamp,
    tryToLock,
    waitForLock,
    setExpiryLimit,
    getExpiryLimit,
    release,
    releaseAll,
    reset,
  };
};
