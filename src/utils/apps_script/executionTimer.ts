/** Default Apps Script execution limit: 6 minutes. */
const DEFAULT_EXECUTION_LIMIT_MS = 6 * 60 * 1000;
/** Default time kept in reserve before the limit. */
const DEFAULT_SAFETY_MARGIN_MS = 30 * 1000;

/** Tracks the elapsed time of an execution to stop before Apps Script does. */
interface ExecutionTimerApi {
  readonly executionLimit: number;
  start(): number;
  reset(): void;
  getElapsedTime(): number;
  getTimeRemaining(): number;
  /** Time left before the safety margin is reached. */
  getTimeRemainingSafe(): number;
  setSafetyMargin(ms: number): void;
  isTimeNearlyUp(): boolean;
  hasTimeLeft(): boolean;
  /** Throws when the safety margin has been reached. */
  throwIfTimeUp(): void;
}

/**
 * Creates an execution timer.
 * @param executionLimit Limit in milliseconds; defaults to 6 minutes.
 */
function ExecutionTimer_(
  executionLimit = DEFAULT_EXECUTION_LIMIT_MS,
): ExecutionTimerApi {
  let timerStart: number | undefined;
  let safetyMargin = DEFAULT_SAFETY_MARGIN_MS;

  const getElapsedTime = (): number => {
    if (timerStart === undefined)
      throw new Error(
        'ExecutionTimer.start() must be called before checking time',
      );
    return Date.now() - timerStart;
  };

  const getTimeRemaining = () => Math.max(0, executionLimit - getElapsedTime());

  const isTimeNearlyUp = () => getTimeRemaining() <= safetyMargin;

  return {
    executionLimit,
    start() {
      timerStart = Date.now();
      return timerStart;
    },
    reset() {
      timerStart = undefined;
    },
    getElapsedTime,
    getTimeRemaining,
    getTimeRemainingSafe: () =>
      Math.max(0, executionLimit - safetyMargin - getElapsedTime()),
    setSafetyMargin(ms) {
      safetyMargin = ms;
    },
    isTimeNearlyUp,
    hasTimeLeft: () => !isTimeNearlyUp(),
    throwIfTimeUp() {
      if (isTimeNearlyUp()) throw new Error('Execution time limit approaching');
    },
  };
}
