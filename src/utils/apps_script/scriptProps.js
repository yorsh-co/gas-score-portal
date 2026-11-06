/**
 * Utility module for working with Google Apps Script Properties.
 * Provides methods to add, get, delete, and list Script Properties.
 * @module ScriptProps
 */
const ScriptProps = (() => {
  const props = PropertiesService.getScriptProperties();

  /**
   * Ensures the value is a string.
   * @param {any} val
   * @returns {string}
   */
  const toString = (val) => (typeof val === 'string' ? val : val.toString());

  /**
   * Add entry to Script Properties.
   * @param {string} key - Property key
   * @param {string} value - Property value
   */
  const add = (key, value) => {
    key = toString(key);
    value = toString(value);

    props.setProperty(key, value);
    //Logger.log('Added entry to Script Properties with key "%s"', key);
  };

  /**
   * Get value from Script Properties by entry key.
   * @param {string} key - Property key
   * @param {boolean} [remove=false] - Remove property after getting it
   * @returns {string|null} - Property value or null if not found
   */
  const get = (key, remove = false) => {
    key = toString(key);
    const value = props.getProperty(key);

    /*Logger.log(
      value
        ? 'Got value from Script Properties for key "%s"'
        : 'No value found in Script Properties for key "%s"',
      key,
    );*/

    if (value && remove) del(key);
    return value;
  };

  /**
   * Get all property entries.
   * @returns {Object} - All properties as key-value pairs
   */
  const getAll = () => props.getProperties();

  /**
   * Delete entry from Script Properties.
   * @param {string} key - Property key
   */
  const del = (key) => {
    key = toString(key);
    props.deleteProperty(key);
    //Logger.log('Deleted entry from Script Properties for key "%s"', key);
  };

  /**
   * Delete all entries
   */
  const delAll = () => {
    props.deleteAllProperties();
    Logger.log('Deleted all entries from Script Properties');
  };

  return {
    add,
    get,
    getAll,
    del,
    delAll,
  };
})();
