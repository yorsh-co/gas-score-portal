/** Identifies a Drive file or folder by ID or by URL. */
interface DriveRef {
  id?: string;
  url?: string;
}

/** Options of `GDrive.files.search`. */
interface DriveSearchOptions {
  /** Restricts the search to the direct children of a folder. */
  parentId?: string | null;
  /** Matches files whose title contains the text. */
  titleQuery?: string;
  /** Matches files whose content contains the text. */
  fullTextQuery?: string;
  mimeType?: string;
}

/** Google Drive lookups. */
const GDrive = (() => {
  const driveLogger = createModuleLogger_('drive');

  const mimeTypes = {
    gForm: 'application/vnd.google-apps.form',
  };

  const resolveId = ({ id, url }: DriveRef): string | null =>
    id || (url ? DriveUtils.extractIdFromUrl(url) : null);

  /**
   * Opens a folder.
   * @returns The folder, or `null` when it cannot be accessed.
   */
  const getFolder = (ref: DriveRef): GoogleAppsScript.Drive.Folder | null => {
    const folderId = resolveId(ref);
    if (!folderId) return null;
    try {
      return DriveApp.getFolderById(folderId);
    } catch (err) {
      driveLogger.warn('Failed to access folder', {
        folder: ref.url || ref.id,
        error: String(err),
      });
      return null;
    }
  };

  /**
   * Opens a file.
   * @returns The file, or `null` when it cannot be accessed.
   */
  const getFile = (ref: DriveRef): GoogleAppsScript.Drive.File | null => {
    const fileId = resolveId(ref);
    if (!fileId) return null;
    try {
      return DriveApp.getFileById(fileId);
    } catch (err) {
      driveLogger.warn('Failed to access file', {
        file: ref.url || ref.id,
        error: String(err),
      });
      return null;
    }
  };

  /**
   * Searches files by title or content, inside a folder and of a type.
   * @throws {Error} When neither a title nor a content query is given.
   */
  const searchFiles = ({
    parentId,
    titleQuery,
    fullTextQuery,
    mimeType,
  }: DriveSearchOptions = {}): GoogleAppsScript.Drive.File[] => {
    const andParts: string[] = [];
    const orParts: string[] = [];
    if (parentId) andParts.push(`'${parentId}' in parents`);
    if (titleQuery)
      orParts.push(
        `title contains '${DriveUtils.escapeSearchQueryString(titleQuery)}'`,
      );
    if (fullTextQuery)
      orParts.push(
        `fullText contains '${DriveUtils.escapeSearchQueryString(fullTextQuery)}'`,
      );
    if (mimeType) andParts.push(`mimeType = '${mimeType}'`);

    if (!orParts.length)
      throw new Error('searchFiles requires at least one query parameter');
    andParts.push(
      orParts.length > 1 ? `(${orParts.join(' or ')})` : orParts[0]!,
    );

    const query = andParts.join(' and ');
    const iterator = DriveApp.searchFiles(query);
    const files: GoogleAppsScript.Drive.File[] = [];
    while (iterator.hasNext()) files.push(iterator.next());
    driveLogger.info('Drive search finished', { count: files.length, query });
    return files;
  };

  return {
    folders: {
      hasAccess: (ref: DriveRef): boolean => getFolder(ref) !== null,
      get: getFolder,
    },
    files: {
      hasAccess: (ref: DriveRef): boolean => getFile(ref) !== null,
      get: getFile,
      search: searchFiles,
    },
    mimeTypes,
  };
})();
