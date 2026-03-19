/**
 * @module ExecutionTimer
 * Utility for tracking script execution time and preventing Apps Script timeouts.
 *
 * @param {Number} executionLimit - Defaults to 6 minuted
 */
const ExecutionTimer = (executionLimit = 6 * 60 * 1000) => {
  let timerStart;
  let safetyMargin = 30 * 1000;
  let timeElapsed = 0;

  const start = () => {
    timerStart = Date.now();
    timeElapsed = 0;
    return timerStart;
  };

  const ensureStarted = () => {
    if (!timerStart) {
      throw new Error(
        'ExecutionTimer.start() must be called before checking time',
      );
    }
  };

  const getElapsedTime = () => {
    ensureStarted();
    timeElapsed = Date.now() - timerStart;
    return timeElapsed;
  };

  const getTimeRemaining = () => {
    ensureStarted();
    return Math.max(0, executionLimit - getElapsedTime());
  };

  const getTimeRemainingSafe = () => {
    ensureStarted();
    return Math.max(0, executionLimit - safetyMargin - getElapsedTime());
  };

  const setSafetyMargin = (ms) => {
    safetyMargin = ms;
  };

  const isTimeNearlyUp = () => {
    return getTimeRemaining() <= safetyMargin;
  };

  const hasTimeLeft = () => {
    return !isTimeNearlyUp();
  };

  const throwIfTimeUp = () => {
    if (isTimeNearlyUp()) {
      throw new Error('Execution time limit approaching');
    }
  };

  const reset = () => {
    timerStart = undefined;
    timeElapsed = 0;
  };

  return {
    executionLimit,
    start,
    reset,
    getElapsedTime,
    getTimeRemaining,
    getTimeRemainingSafe,
    setSafetyMargin,
    isTimeNearlyUp,
    hasTimeLeft,
    throwIfTimeUp,
  };
};
