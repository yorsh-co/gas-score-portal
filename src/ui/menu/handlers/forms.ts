const formsMenuLogger = createModuleLogger('menu.forms');

/**
 * Returns the URLs of the forms in the rows selected on the `Forms` sheet.
 * Throws when the active sheet is another one or nothing is selected.
 */
function getSelectedFormUrls(): string[] {
  const table = getFormsTable();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheet.getActiveSheet().getName() !== table.sheetName)
    throw new GasValidationError(
      `Esta ação é possível apenas a partir da aba ${table.sheetName}`,
    );

  table.schema.ensureColumns(['url']);
  const urlCol = table.schema.columnKeys.indexOf('url') + 1;
  const urls = new Set<string>();
  for (const range of table.sheet.getActiveRangeList()?.getRanges() ?? []) {
    const first = Math.max(range.getRow(), table.rowNumbers.firstData);
    const count = range.getLastRow() - first + 1;
    if (count < 1) continue;
    for (const [value] of table.sheet
      .getRange(first, urlCol, count, 1)
      .getValues()) {
      const url = String(value).trim();
      if (url) urls.add(url);
    }
  }
  if (!urls.size) throw new GasValidationError('Nenhum Forms selecionado');
  return [...urls];
}

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
    createFormsRepo(getFormsTable()).upsert({
      url: formUrl,
      title: formTitle,
      status: 'linked',
      error: '',
    });
    Toast.success(`"${formTitle}" vinculado`);
  });
}

/**
 * Removes the selected Forms from the system and excludes them from sync.
 */
function menuRemoveForms(): void {
  runMenuAction(formsMenuLogger, () => {
    Toast.loading();

    const forms = createFormsRepo(getFormsTable());
    const stored = new Map(forms.list().map((form) => [form.url, form]));
    const linkedForms = getSelectedFormUrls()
      .filter((url) => stored.has(url))
      .map((url) => ({ url, title: stored.get(url)?.title || url }));
    if (!linkedForms.length)
      throw new GasValidationError('Nenhum Forms selecionado');

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
      forms.updateStatus(linkedForm.url, 'excluded'),
    );

    Toast.success('Forms removidos');
  });
}
