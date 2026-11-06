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
    Toast.loading('Buscando Forms no Drive');

    const newForms = this.filterNewForms(this.fetchForms());
    this.logger.info('Found new forms', { count: newForms.length });
    Toast.busy(`Importando ${newForms.length} novos Forms`);

    this.insertForms(newForms);
  }

  private resolveParentFolder(): void {
    if (!this.parentFolderUrl && !this.allowPrompt)
      throw new GasValidationError(
        'Parent folder URL is required. Set the Drive folder URL in the settings.',
      );

    while (!this.parentFolderId) {
      if (!this.parentFolderUrl)
        this.parentFolderUrl = this.promptForFolderUrl();

      if (this.parentFolderUrl) {
        if (GDrive.folders.hasAccess({ url: this.parentFolderUrl })) {
          this.parentFolderId = DriveUtils.extractIdFromUrl(
            this.parentFolderUrl,
          );
        } else {
          this.warning =
            `Não foi possível acessar a pasta em "${this.parentFolderUrl}". ` +
            `Verifique se você tem permissão para acessar a pasta.`;
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
      '🟪 Importar Forms do Drive',

      'Insira o URL da pasta do Drive que contém os Forms a serem vinculados ao sistema.\n\n' +
        'Deixe vazio para importar Forms de todo o Drive.\n\n' +
        '👉 Observações:\n' +
        '- Apenas Forms que correspondam às configurações serão importados.\n' +
        '- Novos Forms na pasta serão importados automaticamente em até 60 minutos.',

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
      ...getExcludedFormUrls(),
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
