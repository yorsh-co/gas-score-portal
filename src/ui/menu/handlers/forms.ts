const formsMenuLogger = createModuleLogger_('menu.forms');

/**
 * Returns the URLs of the forms in the rows selected on the `Forms` sheet.
 * Throws when the active sheet is another one or nothing is selected.
 */
function getSelectedFormUrls_(): string[] {
  const table = getFormsTable_();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheet.getActiveSheet().getName() !== table.sheetName)
    throw new GasValidationError(
      tr_('forms.wrongSheet', { sheetName: table.sheetName }),
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
  if (!urls.size) throw new GasValidationError(tr_('forms.noneSelected'));
  return [...urls];
}

/**
 * Imports the Forms found in the configured Drive folder.
 * @throws {GasForbiddenError} When the caller does not run the script with
 *   their own authority.
 */
function menuImportDriveForms(): void {
  runMenuAction_(formsMenuLogger, () => {
    assertCallerEffectiveUser_();
    Toast.loading();
    new FormsImporter({ allowPrompt: true }).run();
    Toast.success(tr_('forms.imported'));
  });
}

/**
 * Links a single Form, reactivating it if it was excluded.
 * @throws {GasForbiddenError} When the caller does not run the script with
 * their own authority.
 */
function menuLinkNewForm(): void {
  runMenuAction_(formsMenuLogger, () => {
    assertCallerEffectiveUser_();
    Toast.loading();

    let form: GoogleAppsScript.Forms.Form | null = null;
    let warning = '';
    while (!form) {
      const inputUrl = GSheetsUiUtils.promptForValue(
        tr_('forms.linkTitle'),
        tr_('forms.linkPrompt'),
        warning,
      );

      form = GForms.forms.get({ url: inputUrl, id: '' });
      if (!form) warning = tr_('forms.accessWarning', { url: inputUrl });
    }

    const formUrl = form.getEditUrl();
    const excludedUrls = getExcludedFormUrls_();
    if (excludedUrls.includes(formUrl)) {
      const ui = SpreadsheetApp.getUi();
      const selectedButton = ui.alert(
        tr_('forms.reactivateTitle'),
        tr_('forms.reactivateBody', { title: form.getTitle() }),
        ui.ButtonSet.OK_CANCEL,
      );
      if (selectedButton !== ui.Button.OK) throw createCancelledError_();

      saveExcludedFormUrls_(excludedUrls.filter((url) => url !== formUrl));
    }

    const formTitle = form.getTitle();
    Toast.busy(tr_('forms.linking', { title: formTitle }));
    createFormsRepo_(getFormsTable_()).upsert({
      url: formUrl,
      title: formTitle,
      status: 'linked',
      error: '',
    });
    Toast.success(tr_('forms.linked', { title: formTitle }));
  });
}

/**
 * Removes the selected Forms from the system and excludes them from sync.
 * @throws {GasForbiddenError} When the caller does not run the script with
 * their own authority.
 */
function menuRemoveForms(): void {
  runMenuAction_(formsMenuLogger, () => {
    assertCallerEffectiveUser_();
    Toast.loading();

    const forms = createFormsRepo_(getFormsTable_());
    const stored = new Map(forms.list().map((form) => [form.url, form]));
    const linkedForms = getSelectedFormUrls_()
      .filter((url) => stored.has(url))
      .map((url) => ({ url, title: stored.get(url)?.title || url }));
    if (!linkedForms.length)
      throw new GasValidationError(tr_('forms.noneSelected'));

    const ui = SpreadsheetApp.getUi();
    const selectedButton = ui.alert(
      tr_('forms.removeTitle'),
      tr_('forms.removeBody', {
        list: linkedForms
          .map((linkedForm, i) => `${i + 1}. ${linkedForm.title}\n`)
          .join(''),
      }),
      ui.ButtonSet.OK_CANCEL,
    );
    if (selectedButton !== ui.Button.OK) throw createCancelledError_();

    Toast.busy(tr_('forms.removing', { count: linkedForms.length }));
    const excludedUrls = new Set(getExcludedFormUrls_());
    linkedForms.forEach((linkedForm) => excludedUrls.add(linkedForm.url));
    saveExcludedFormUrls_([...excludedUrls]);

    linkedForms.forEach((linkedForm) =>
      forms.updateStatus(linkedForm.url, 'excluded'),
    );

    Toast.success(tr_('forms.removed'));
  });
}
