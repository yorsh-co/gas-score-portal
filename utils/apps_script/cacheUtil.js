/**
 * Cache Utility Module for interacting with the Google Apps Script Script Cache.
 * @module CacheUtil
 */
const CacheUtil = (() => {
  const cache = CacheService.getScriptCache();

  /** Default cache keys */
  const CACHE_ENTRY_KEYS = {};

  /**
   * Returns the value as a string.
   * @param {*} value
   * @returns {String}
   */
  const toString = (value) =>
    typeof value === 'string' ? value : value.toString();

  /**
   * Adds a value to the script cache.
   * @param {string} key - The cache key.
   * @param {string} value - The value to store.
   * @param {number} expiration - Seconds.
   */
  const add = (key, value, expiration) => {
    key = toString(key);
    value = toString(value);

    expiration ? cache.put(key, value, expiration) : cache.put(key, value);
    //Logger.log('Added entry %s:%s to Script Cache', key, value);
  };

  /**
   * Gets a value from the script cache.
   * @param {string} key - The cache key.
   * @param {boolean} [remove=false] - If true, deletes the cache entry after getting it.
   * @returns {string|null} - The cached value or null if not found.
   */
  const get = (key, remove = false) => {
    key = toString(key);

    const value = cache.get(key);
    /*Logger.log(
      value
        ? 'Got value from Script Cache for key "%s": %s'
        : 'No value found in Script Cache for key "%s"',
      key,
      value,
    );*/

    if (value && remove) removeEntry(key);
    return value;
  };

  /**
   * Deletes a cache entry.
   * @param {string} key - The cache key to remove.
   */
  const removeEntry = (key) => {
    key = toString(key);
    cache.remove(key);
    //Logger.log('Deleted entry from Script Cache for key "%s"', key);
  };

  /**
   * Clears all cache entries for the given keys.
   * @param {string[]} keys - An array of cache keys to remove.
   */
  const clearAllForKeys = (keys) => {
    if (!Array.isArray(keys)) return;
    cache.removeAll(keys.map(toString));
    Logger.log('Cleared all cache entries for keys: %s', keys.join(', '));
  };

  return {
    add,
    get,
    remove: removeEntry,
    clearAllForKeys,
    CACHE_ENTRY_KEYS, // expose constants if needed
  };
})();
