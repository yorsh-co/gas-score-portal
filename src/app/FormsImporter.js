class FormsImporter {
  /**
   *
   * @param {object} options
   * @param {boolean} options.allowPrompt
   */
  constructor(options = {}) {
    this.parentFolderUrl = Config.data.gDrive.parentFolderUrl;
    this.parentFolderId = null;
    this.warning = null;
    this.allowPrompt = options.allowPrompt;
  }

  run() {
    this.resolveParentFolder();
    Config.data.gDrive.parentFolderUrl = this.parentFolderUrl;
    Config.save();
    Toast.loading('Buscando Forms no Drive');

    const forms = this.fetchForms();
    const newForms = this.filterExistingForms(forms);
    Logger.log('Got %s new forms', newForms.length);
    Toast.busy(`Importando ${newForms.length} novos Forms`);

    this.insertForms(newForms);
  }

  resolveParentFolder() {
    if (!this.parentFolderUrl && !this.allowPrompt)
      throw new Error(
        'Parent folder URL is required. Please provide the folder URL in the configurations sheet',
      );

    while (!this.parentFolderId) {
      if (!this.parentFolderUrl)
        this.parentFolderUrl = this.promptForFolderUrl();

      if (this.parentFolderUrl) {
        if (
          GDrive.folders.hasAccess({
            url: this.parentFolderUrl,
          })
        ) {
          this.parentFolderId = DriveUtils.extractIdFromUrl(
            this.parentFolderUrl,
          );
          Logger.log('Parent folder set to "%s"', this.parentFolderUrl);
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
        Logger.log('Parent folder set to root (%s)', this.parentFolderId);
      }
    }
  }

  promptForFolderUrl() {
    return GSheetsUiUtils.promptForValue(
      '🟪 Importar Forms do Drive',

      'Insira o URL da pasta do Drive que contém os Forms a serem vinculados ao sistema. ' +
        'Os Forms podem estar em subpastas.\n\n' +
        'Deixe vazio para importar Forms de todo o Drive.\n\n' +
        '👉 Observações:\n' +
        '- Apenas Forms que correspondam às configurações em "⚙️ Config" serão importados.\n' +
        '- Novos Forms na pasta (ou subpastas) serão importados automaticamente em até 60 minutos.',

      this.warning,

      { acceptBlank: true },
    );
  }

  fetchForms() {
    const files = GDrive.files.search({
      parentId: this.parentFolderId,
      titleQuery: Config.data.gForms.titleQuery,
      fullTextQuery: Config.data.gForms.fullTextQuery,
      mimeType: GDrive.mimeTypes.gForm,
    });

    return files.map((file) => FormApp.openById(file.getId()));
  }

  filterExistingForms(forms) {
    const linkedFormUrls = FormsSheet.getLinkedFormUrls();
    return forms.filter((form) => !linkedFormUrls.includes(form.getEditUrl()));
  }

  insertForms(forms) {
    const newLinkedForms = forms.map((form) =>
      new LinkedForm().initializeFromForm(form),
    );

    FormsSheet.insertNewLinkedForms(newLinkedForms);
  }
}
