/** Options of `FormsImporter`. */
interface FormsImporterOptions {
  /** Ask the user for the folder when none is configured. */
  allowPrompt?: boolean;
  /** Started timer; the import stops opening Forms when time is low. */
  timer?: ExecutionTimerApi;
}

/** Finds the Forms in a Drive folder and links the new ones. */
class FormsImporter {
  private parentFolderUrl: string;
  private parentFolderId: string | null = null;
  private warning: string | null = null;
  private readonly allowPrompt: boolean;
  private readonly timer: ExecutionTimerApi | undefined;
  private readonly logger = createModuleLogger('importer');

  constructor(options: FormsImporterOptions = {}) {
    this.parentFolderUrl = getConfig().get('driveFolderUrl') ?? '';
    this.allowPrompt = options.allowPrompt ?? false;
    this.timer = options.timer;
  }

  /**
   * Imports the Forms that are not linked yet and are not excluded.
   */
  run(): void {
    this.resolveParentFolder();
    this.persistParentFolder();
    Toast.loading(tr('importer.searching'));

    const newForms = this.filterNewForms(this.fetchForms());
    this.logger.info('Found new forms', { count: newForms.length });
    Toast.busy(tr('importer.importing', { count: newForms.length }));

    this.insertForms(newForms);
  }

  private resolveParentFolder(): void {
    if (!this.parentFolderUrl && !this.allowPrompt)
      throw new GasValidationError(tr('importer.folderRequired'));

    while (!this.parentFolderId) {
      if (!this.parentFolderUrl)
        this.parentFolderUrl = this.promptForFolderUrl();

      if (this.parentFolderUrl) {
        if (GDrive.folders.hasAccess({ url: this.parentFolderUrl })) {
          this.parentFolderId = DriveUtils.extractIdFromUrl(
            this.parentFolderUrl,
          );
        } else {
          this.warning = tr('importer.folderAccessWarning', {
            url: this.parentFolderUrl,
          });
          this.parentFolderUrl = '';
        }
      } else {
        const root = DriveApp.getRootFolder();
        this.parentFolderId = root.getId();
        this.parentFolderUrl = root.getUrl();
      }
    }
    this.logger.info('Parent folder resolved', { url: this.parentFolderUrl });
  }

  /** Saves the folder in the settings when it changed. A failure is only logged. */
  private persistParentFolder(): void {
    if (this.parentFolderUrl === (getConfig().get('driveFolderUrl') ?? ''))
      return;
    try {
      saveDriveFolderUrl(this.parentFolderUrl);
    } catch (err) {
      this.logger.warn('Could not save the Drive folder in the settings', {
        error: getErrorMessage(err),
      });
    }
  }

  private promptForFolderUrl(): string {
    return GSheetsUiUtils.promptForValue(
      tr('importer.promptTitle'),
      tr('importer.promptBody'),
      this.warning,

      { acceptBlank: true },
    );
  }

  private fetchForms(): GoogleAppsScript.Forms.Form[] {
    const config = getConfig();
    const files = GDrive.files.search({
      parentId: this.parentFolderId,
      titleQuery: config.get('formsTitleQuery') ?? '',
      fullTextQuery: config.get('formsFullTextQuery') ?? '',
      mimeType: GDrive.mimeTypes.gForm,
    });

    const forms: GoogleAppsScript.Forms.Form[] = [];
    for (const file of files) {
      if (this.timer && !this.timer.hasTimeLeft()) {
        this.logger.warn(
          'Out of time, the remaining forms wait for the next run',
          {
            pending: files.length - forms.length,
          },
        );
        break;
      }
      forms.push(FormApp.openById(file.getId()));
    }
    return forms;
  }

  private filterNewForms(
    forms: GoogleAppsScript.Forms.Form[],
  ): GoogleAppsScript.Forms.Form[] {
    const known = new Set([
      ...createFormsRepo(getFormsTable())
        .list()
        .map((form) => form.url),
      ...getExcludedFormUrls_(),
    ]);
    return forms.filter((form) => !known.has(form.getEditUrl()));
  }

  private insertForms(forms: GoogleAppsScript.Forms.Form[]): void {
    const repo = createFormsRepo(getFormsTable());
    for (const form of forms) {
      const linked = new LinkedForm().initializeFromForm(form);
      repo.upsert({ url: linked.url, title: linked.title, status: 'linked' });
    }
  }
}
