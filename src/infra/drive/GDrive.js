/**
 *
 */
const GDrive = (() => {
  const mimeTypes = {
    gForm: 'application/vnd.google-apps.form',
  };

  /**
   *
   * @param {object} params
   * @param {string} params.url
   * @param {string} params.id
   * @returns {boolean}
   */
  const checkFolderAccess_ = ({ url, id }) => {
    return getFolder_({ url: url, id: id }) != undefined;
  };

  /**
   *
   * @param {object} params
   * @param {string} params.url
   * @param {string} params.id
   * @returns {boolean}
   */
  const checkFileAccess_ = ({ url, id }) => {
    return getFile_({ url: url, id: id }) != undefined;
  };

  /**
   *
   * @param {object} params
   * @param {string} params.url
   * @param {string} params.id
   * @returns {GoogleAppsScript.Drive.Folder}
   */
  const getFolder_ = ({ url, id }) => {
    const folderId = id || DriveUtils.extractIdFromUrl(url);

    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (err) {
      console.error(err);
    }

    if (!folder) console.error('Failed to access folder', url || id);

    return folder;
  };

  /**
   *
   * @param {object} params
   * @param {string} params.url
   * @param {string} params.id
   * @returns {GoogleAppsScript.Drive.File}
   */
  const getFile_ = ({ url, id }) => {
    const fileId = id || DriveUtils.extractIdFromUrl(url);

    let file;
    try {
      file = DriveApp.getFileById(fileId);
    } catch (err) {
      console.error(err);
    }

    if (!file) console.error('Failed to access file', url || id);

    return file;
  };

  /**
   *
   * @param {object} options
   * @param {GoogleAppsScript.Drive.Folder} options.parentId
   * @param {string} options.titleQuery
   * @param {string} options.fullTextQuery
   * @param {boolean} options.mimeType
   *
   * @return {[GoogleAppsScript.Drive.File]}
   */
  const searchFiles_ = ({
    parentId,
    titleQuery,
    fullTextQuery,
    mimeType,
  } = {}) => {
    const andQueryParts = [];
    const orQueryParts = [];
    if (parentId) andQueryParts.push(`'${parentId}' in parents`);
    if (titleQuery)
      orQueryParts.push(
        `title contains '${DriveUtils.escapeSearchQueryString(titleQuery)}'`,
      );
    if (fullTextQuery)
      orQueryParts.push(
        `fullText contains '${DriveUtils.escapeSearchQueryString(fullTextQuery)}'`,
      );
    if (mimeType) andQueryParts.push(`mimeType = '${mimeType}'`);

    if (orQueryParts.length)
      andQueryParts.push(orQueryParts.length > 1 ? `(${orQueryParts.filter(Boolean).join(' or ')})` : orQueryParts[0]);

    if (!orQueryParts.length)
      throw new Error('searchFiles_ requires at least one query parameter');

    const query = andQueryParts.filter(Boolean).join(' and ');
    const fileIterator = DriveApp.searchFiles(query);

    const files = [];
    while (fileIterator.hasNext()) files.push(fileIterator.next());
    Logger.log('Drive returned %s files for query "%s"', files.length, query);

    return files;
  };

  return {
    folders: {
      get hasAccess() {
        return checkFolderAccess_;
      },
      get get() {
        return getFolder_;
      },
    },
    files: {
      get hasAccess() {
        return checkFileAccess_;
      },
      get get() {
        return getFile_;
      },
      get search() {
        return searchFiles_;
      },
    },
    mimeTypes,
  };
})();
