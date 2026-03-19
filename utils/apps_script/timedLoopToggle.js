/**
 * @module TimedLoopToggle
 * Utility for replacing LockService by using timestamp stored in the script properties.
 * Useful for when LockService doesn't perform as expected.
 * ⚠️ Not atomic — does NOT fully replace LockService.
 */
const TimedLoopToggle = () => {
  const propertyKey = 'loopToggle';
  const toggle = {
    paused: 'paused',
    unpaused: 'live',
  };

  /**
   *
   * @returns {Boolean}
   */
  const isPaused = () => {
    let currentStatus = ScriptProps.get(propertyKey);

    if (!currentStatus) return false;

    return currentStatus === toggle.paused;
  };

  const pause = () => {
    ScriptProps.add(propertyKey, toggle.paused);
    Logger.log(
      'Updated timed loop toggle in script properties to "%s"',
      toggle.paused
    );
  };

  const unpause = () => {
    ScriptProps.add(propertyKey, toggle.unpaused);
    Logger.log(
      'Updated timed loop toggle in script properties to "%s"',
      toggle.unpaused
    );
  };

  const reset = () => {
    ScriptProps.del(propertyKey);
  };

  return {
    isPaused,
    pause,
    unpause,
    reset,
  };
};
