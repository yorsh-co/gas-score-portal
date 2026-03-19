const FormsSheet = (() => {
  const sheetDef = SHEETS.forms;
  const sheet = SS.getSheetByName(sheetDef.name);

  const isActive = () => SS.getActiveSheet().getName() === sheetDef.name;

  const getActiveFormRows = () =>
    sheet
      .getActiveRangeList()
      .getRanges()
      .map((r) => r.getRow())
      .filter(
        (rowNum) =>
          rowNum >= sheetDef.rows.first &&
          sheet.getRange(rowNum, sheetDef.cols.url).getValue(),
      );

  /**
   *
   * @param {object} params
   * @param {FormsCursor} cursor
   * @param {Number} rowNum
   *
   * @returns {LinkedForm}
   */
  const getLinkedForm = ({ cursor = null, rowNum = null } = {}) => {
    const formRowArr = sheet
      .getRange(
        cursor ? sheetDef.rows.first + cursor.formUrlIndex : rowNum,
        sheetDef.cols.first,
        1,
        sheetDef.cols.last,
      )
      .getValues()[0];

    const url = formRowArr[sheetDef.cols.url - 1];
    const linkedForm = new LinkedForm().initializeFromUrl(url);
    if (!linkedForm.form)
      throw new Error(`Failed to access the Google Form "${url}"`);

    linkedForm.timestamp = formRowArr[sheetDef.cols.timestamp - 1];

    return linkedForm;
  };

  /**
   *
   * @returns {[string]}
   */
  const getLinkedFormUrls = () => {
    const numUrls = sheet.getLastRow() - (sheetDef.rows.first - 1);
    return numUrls > 0
      ? sheet
          .getRange(sheetDef.rows.first, sheetDef.cols.url, numUrls, 1)
          .getValues()
          .map((rowArr) => rowArr[0])
      : [];
  };

  /**
   *
   * @param {[LinkedForm]} linkedForms
   */
  const insertNewLinkedForms = (linkedForms) => {
    for (const linkedForm of linkedForms) {
      let rowNum;
      // Check for duplicate forms.
      const linkedFormUrls = getLinkedFormUrls();
      if (linkedFormUrls.includes(linkedForm.url))
        rowNum = linkedFormUrls.indexOf(linkedForm.url) + sheetDef.rows.first;

      const arr = linkedForm.getDataArray(sheetDef.cols);
      if (!rowNum) {
        const lastRow = sheet.getLastRow();
        const maxRows = sheet.getMaxRows() - 1;
        if (lastRow + 1 - maxRows > 0) sheet.insertRowAfter(lastRow);
        rowNum = lastRow + 1;
      }
      sheet
        .getRange(rowNum, sheetDef.cols.first, 1, arr.length)
        .setValues([arr]);

      // Set the forms status.
      updateFormStatus(linkedForm, LinkedForm.statusEnum.linked, {
        rowNum: rowNum,
      });
    }

    // Sort the forms by alphabetical order.
    sheet
      .getRange(
        sheetDef.rows.first,
        sheetDef.cols.first,
        sheet.getLastRow() - (sheetDef.rows.first - 1),
        sheetDef.cols.last - (sheetDef.cols.first - 1),
      )
      .sort(sheetDef.cols.title - (sheetDef.cols.first - 1));

    Logger.log('Inserted %s new linked forms', linkedForms.length);
  };

  /**
   *
   * @param {LinkedForm} linkedForm
   * @param {number} rowNum
   */
  const setFormTitle = (linkedForm, rowNum) => {
    if (!rowNum) rowNum = linkedForm.getRowNum();
    sheet
      .getRange(rowNum, sheetDef.cols.title)
      .setValue(linkedForm.form.getTitle());
    Logger.log('Set title for form at row %s (%s)', rowNum, linkedForm.url);
  };

  /**
   *
   * @param {{ text: string, background: string }} status
   * @param {object} options
   * @param {number} options.rowNum
   * @param {string} options.error
   */
  const updateFormStatus = (linkedForm, status, options = {}) => {
    let rowNum = options.rowNum;
    if (!rowNum) rowNum = linkedForm.getRowNum();
    sheet
      .getRange(rowNum, sheetDef.cols.status)
      .setValue(StringUtils.replacePlaceholders(status.text, options))
      .setBackground(status.background);
    Logger.log('Set form status at row %s for "%s"', rowNum, linkedForm.url);
  };

  /**
   *
   * @param {LinkedForm} linkedForm
   * @param {number} rowNum
   */
  const updateFormTimestamp = (linkedForm, rowNum) => {
    if (!rowNum) rowNum = linkedForm.getRowNum();
    sheet.getRange(rowNum, sheetDef.cols.timestamp).setValue(new Date());
    Logger.log(
      'Updated timestamp for form at row %s (%s)',
      rowNum,
      linkedForm.url,
    );
  };

  /**
   *
   * @param {FormsCursor} cursor
   */
  const hasMoreLinkedForms = (cursor) => {
    return sheetDef.rows.first + cursor.formUrlIndex + 1 <= sheet.getLastRow();
  };

  return Object.freeze({
    sheet,
    isActive,
    getActiveFormRows,
    getLinkedForm,
    getLinkedFormUrls,
    insertNewLinkedForms,
    setFormTitle,
    updateFormStatus,
    updateFormTimestamp,
    hasMoreLinkedForms,
  });
})();
