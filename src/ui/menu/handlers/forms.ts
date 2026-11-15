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
      tr('forms.wrongSheet', { sheetName: table.sheetName }),
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
  if (!urls.size) throw new GasValidationError(tr('forms.noneSelected'));
  return [...urls];
}

/**
 * Imports the Forms found in the configured Drive folder.
 * @throws {GasForbiddenError} When the caller does not run the script with
 *   their own authority.
 */
function menuImportDriveForms(): void {
  runMenuAction(formsMenuLogger, () => {
    assertCallerEffectiveUser_();
    Toast.loading();
    new FormsImporter({ allowPrompt: true }).run();
    Toast.success(tr('forms.imported'));
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
        tr('forms.linkTitle'),
        tr('forms.linkPrompt'),
        warning,
      );

      form = GForms.forms.get({ url: inputUrl, id: '' });
      if (!form) warning = tr('forms.accessWarning', { url: inputUrl });
    }

    const formUrl = form.getEditUrl();
    const excludedUrls = getExcludedFormUrls_();
    if (excludedUrls.includes(formUrl)) {
      const ui = SpreadsheetApp.getUi();
      const selectedButton = ui.alert(
        tr('forms.reactivateTitle'),
        tr('forms.reactivateBody', { title: form.getTitle() }),
        ui.ButtonSet.OK_CANCEL,
      );
      if (selectedButton !== ui.Button.OK) throw createCancelledError();

      saveExcludedFormUrls(excludedUrls.filter((url) => url !== formUrl));
    }

    const formTitle = form.getTitle();
    Toast.busy(tr('forms.linking', { title: formTitle }));
    createFormsRepo(getFormsTable()).upsert({
      url: formUrl,
      title: formTitle,
      status: 'linked',
      error: '',
    });
    Toast.success(tr('forms.linked', { title: formTitle }));
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
      throw new GasValidationError(tr('forms.noneSelected'));

    const ui = SpreadsheetApp.getUi();
    const selectedButton = ui.alert(
      tr('forms.removeTitle'),
      tr('forms.removeBody', {
        list: linkedForms
          .map((linkedForm, i) => `${i + 1}. ${linkedForm.title}\n`)
          .join(''),
      }),
      ui.ButtonSet.OK_CANCEL,
    );
    if (selectedButton !== ui.Button.OK) throw createCancelledError();

    Toast.busy(tr('forms.removing', { count: linkedForms.length }));
    const excludedUrls = new Set(getExcludedFormUrls_());
    linkedForms.forEach((linkedForm) => excludedUrls.add(linkedForm.url));
    saveExcludedFormUrls([...excludedUrls]);

    linkedForms.forEach((linkedForm) =>
      forms.updateStatus(linkedForm.url, 'excluded'),
    );

    Toast.success(tr('forms.removed'));
  });
}
