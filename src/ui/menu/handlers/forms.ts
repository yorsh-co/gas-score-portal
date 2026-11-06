const formsMenuLogger = createModuleLogger('menu.forms');

/**
 * Imports the Forms found in the configured Drive folder.
 */
function menuImportDriveForms(): void {
  runMenuAction(formsMenuLogger, () => {
    Toast.loading();
    new FormsImporter({ allowPrompt: true }).run();
    Toast.success('Forms importados');
  });
}

/**
 * Links a single Form, reactivating it if it was excluded.
 */
function menuLinkNewForm(): void {
  runMenuAction(formsMenuLogger, () => {
    Toast.loading();

    let form: GoogleAppsScript.Forms.Form | null = null;
    let warning = '';
    while (!form) {
      const inputUrl = GSheetsUiUtils.promptForValue(
        '➕ Adicionar Forms individual',
        'Insira o URL do arquivo Forms a ser vinculado ao sistema.',
        warning,
      );

      form = GForms.forms.get({ url: inputUrl, id: '' });
      if (!form)
        warning = `Não foi possível acessar o Forms "${inputUrl}". Verifique se você tem permissão para acessar a arquivo.`;
    }

    const formUrl = form.getEditUrl();
    const excludedUrls = getExcludedFormUrls();
    if (excludedUrls.includes(formUrl)) {
      const ui = SpreadsheetApp.getUi();
      const selectedButton = ui.alert(
        '➕ Reativar Forms',
        `O Forms "${form.getTitle()}" consta na lista de Forms removidos.\n\n👉 Clique em OK para reativar esse Forms.`,
        ui.ButtonSet.OK_CANCEL,
      );
      if (selectedButton !== ui.Button.OK) throw createCancelledError();

      saveExcludedFormUrls(excludedUrls.filter((url) => url !== formUrl));
    }

    const formTitle = form.getTitle();
    Toast.busy(`Vinculando "${formTitle}"...`);
    const linkedForm = new LinkedForm().initializeFromForm(form);
    FormsSheet.insertNewLinkedForms([linkedForm]);
    Toast.success(`"${formTitle}" vinculado`);
  });
}

/**
 * Removes the selected Forms from the system and excludes them from sync.
 */
function menuRemoveForms(): void {
  runMenuAction(formsMenuLogger, () => {
    Toast.loading();

    if (!FormsSheet.isActive())
      throw new GasValidationError(
        `Esta ação é possível apenas a partir da aba ${SHEETS.forms.name}`,
      );

    const activeRows = FormsSheet.getActiveFormRows();
    if (!activeRows.length)
      throw new GasValidationError('Nenhum Forms selecionado');

    const linkedForms = activeRows.map((rowNum) =>
      FormsSheet.getLinkedForm({ rowNum }),
    );

    const ui = SpreadsheetApp.getUi();
    const selectedButton = ui.alert(
      '➖ Remover Forms',
      `Os Forms abaixo serão removidos do sistema e ignorados durante a sincronização das notas:\n\n${linkedForms.map((linkedForm, i) => `${i + 1}. ${linkedForm.title}\n`)}\nPara reativar um desses Forms, utilize o botão "➕ Adicionar Forms individual".\n\n👉 Clique em OK para continuar.`,
      ui.ButtonSet.OK_CANCEL,
    );
    if (selectedButton !== ui.Button.OK) throw createCancelledError();

    Toast.busy(`Removendo ${linkedForms.length} Forms...`);
    const excludedUrls = new Set(getExcludedFormUrls());
    linkedForms.forEach((linkedForm) => excludedUrls.add(linkedForm.url));
    saveExcludedFormUrls([...excludedUrls]);

    linkedForms.forEach((linkedForm) =>
      FormsSheet.updateFormStatus(linkedForm, LinkedForm.statusEnum.excluded),
    );

    Toast.success('Forms removidos');
  });
}
